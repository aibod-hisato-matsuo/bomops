"""
Notion エクスポート（from_notion/extracts/）からの初期データ取り込みコマンド

使い方:
  python manage.py import_notion --dir /path/to/extracts --dry-run
  python manage.py import_notion --dir /path/to/extracts

マッピング方針（ユーザー承認済み・2026-06-12）:
- PartUnit の識別子は Notion の Part 名（実S/Nは note へ。重複Part名はサフィックス付与）
- Notion の BOM Category（本体構成品等）と仕様/商品説明は PartMaster.spec_json に格納
- Product Set の Model 列はモデル（BAITEN AI/Mini）と状態（stock等）が混在
  → ProductModel は AI/Mini/UNKNOWN の3つ。状態は BssSet.status へマッピング
- 出荷日 → BssSet.installed_at
- 冪等: 自然キー（名前・コード）で update_or_create。再実行可
"""

import csv
import fnmatch
import re
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from bom.models import (
    BssSet,
    BssSetComponent,
    Customer,
    CustomerSite,
    PartMaster,
    PartUnit,
    ProductModel,
    SiteConfig,
)

NOTION_URL_RE = re.compile(r"\s*\(https://www\.notion\.so/[^)]*\)")
RELATION_ITEM_RE = re.compile(
    r"(.+?)\s*\(https://www\.notion\.so/[^)]+\)(?:,\s*|$)"
)

# Notion Type → PartMaster.Category
TYPE_TO_CATEGORY = {
    "MiniPC": "PC",
    "タッチモニター": "MONITOR",
    "ディスプレイ": "MONITOR",
    "商品カメラ": "CAMERA",
    "Barcode": "BARCODE",
    "PayDevice": "PAYMENT",
    "PayOption": "PAYMENT",
    "モニターケーブル": "CABLE",
}

# サービス管理の稼働 → CustomerSite.LifecycleStatus
LIFECYCLE_MAP = {
    "稼働中": "ACTIVE",
    "撤退済": "WITHDRAWN",
    "拠点": "BASE",
    "貸出中": "LOANED",
    "準備中": "PREPARING",
}

# Product Set の稼働中 → BssSet.Status
SET_STATUS_MAP = {
    "稼働中": "INSTALLED",
    "拠点": "INSTALLED",
    "撤退済": "RECOVERED",
    "準備中": "ASSEMBLED",
}

# SiteConfig: CSV列名 → モデルフィールド
SITECONFIG_COLUMNS = {
    "Loyverse Account": "loyverse_account",
    "Loyverse StoreID": "loyverse_store_id",
    "Loyverse Token": "loyverse_token",
    "SQUARE Account": "square_account",
    "SQU_DEVICE_ID": "squ_device_id",
    "SQU_LOCATION_ID": "squ_location_id",
    "SQU_TOKEN": "squ_token",
    "PAYPAY_SECRET": "paypay_secret",
    "BAITEN_CLOUD_KEY": "baiten_cloud_key",
    "GOOGLE_SECRET": "google_secret",
    "SLACK_BOT_TOKEN": "slack_bot_token",
    "config.toml": "config_toml",
    "baiten env": "baiten_env",
}


def strip_url(value: str) -> str:
    """Notionリレーション値からURLを除去して名前だけ返す"""
    return NOTION_URL_RE.sub("", value or "").strip()


def parse_relations(value: str) -> list[str]:
    """カンマ区切りの複数リレーション値を名前リストに分解する"""
    if not value or not value.strip():
        return []
    names = [m.group(1).strip() for m in RELATION_ITEM_RE.finditer(value)]
    return names if names else [strip_url(value)]


def clean(value: str | None) -> str | None:
    """空文字・N/A を None に正規化する"""
    if value is None:
        return None
    value = value.strip()
    if value in ("", "N/A", "n/a", "-"):
        return None
    return value


def parse_date(value: str | None) -> Any:
    """Notion日付（2023/12/25 等。ロールアップは先頭値）をdateに変換する"""
    value = clean(value)
    if not value:
        return None
    value = value.split(",")[0].strip()
    for fmt in ("%Y/%m/%d", "%Y-%m-%d", "%B %d, %Y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


class Command(BaseCommand):
    help = "Notion エクスポートCSVから初期データを取り込む"

    def add_arguments(self, parser):
        parser.add_argument("--dir", required=True, help="extracts フォルダのパス")
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="DBへ書き込まずマッピング結果と警告だけ表示する",
        )

    def handle(self, *args, **options):
        extracts = Path(options["dir"])
        if not extracts.is_dir():
            raise CommandError(f"ディレクトリが見つかりません: {extracts}")

        self.warnings: list[str] = []
        self.stats: dict[str, dict[str, int]] = {}

        csvs = {
            "bom": self._find(extracts, "BAITEN BOM *_all.csv"),
            "parts": self._find(extracts, "BAITEN Parts *_all.csv"),
            "sets": self._find(extracts, "BAITEN Product Set *_all.csv"),
            "service": self._find(extracts, "*BAITENサービス管理DB*_all.csv"),
            "square": self._find(extracts, "*BAITEN SQUARE DB*_all.csv"),
        }

        with transaction.atomic():
            self._import_part_masters(self._load(csvs["bom"]))
            self._import_customers_sites(self._load(csvs["service"]))
            self._import_product_models()
            self._import_sets(self._load(csvs["sets"]))
            self._import_part_units(self._load(csvs["parts"]))
            self._import_square(self._load(csvs["square"]))

            self._report(dry_run=options["dry_run"])
            if options["dry_run"]:
                transaction.set_rollback(True)
                self.stdout.write(self.style.WARNING("dry-run のためロールバックしました"))

    # ------------------------------------------------------------------
    # ヘルパ
    # ------------------------------------------------------------------

    def _find(self, root: Path, pattern: str) -> Path:
        # macOSのファイル名はNFD正規化されているため、NFCに揃えて比較する
        matches = sorted(
            p
            for p in root.rglob("*_all.csv")
            if fnmatch.fnmatch(unicodedata.normalize("NFC", p.name), pattern)
        )
        if not matches:
            raise CommandError(f"CSVが見つかりません: {pattern}")
        return matches[0]

    def _load(self, path: Path) -> list[dict[str, str]]:
        with open(path, encoding="utf-8-sig") as fp:
            return list(csv.DictReader(fp))

    def _count(self, model: str, action: str) -> None:
        self.stats.setdefault(model, {"created": 0, "updated": 0, "skipped": 0})
        self.stats[model][action] += 1

    def _warn(self, message: str) -> None:
        self.warnings.append(message)

    # ------------------------------------------------------------------
    # 1. 部品マスタ（BAITEN BOM）
    # ------------------------------------------------------------------

    def _import_part_masters(self, rows: list[dict[str, str]]) -> None:
        prefix_seq: dict[str, int] = {}
        for row in rows:
            name = clean(row["Item"])
            if not name:
                self._count("PartMaster", "skipped")
                continue

            type_label = clean(row.get("Type Label"))
            if type_label in (None, "None"):
                type_label = "PM"
            prefix_seq[type_label] = prefix_seq.get(type_label, 0) + 1
            generated_code = f"{type_label}-M{prefix_seq[type_label]:03d}"

            spec_json = {
                "notion_category": clean(row.get("Category")),
                "notion_type": clean(row.get("Type")),
                "type_label": type_label,
                "spec": clean(row.get("仕様")),
                "description": clean(row.get("商品説明")),
            }
            defaults = {
                "category": TYPE_TO_CATEGORY.get(clean(row.get("Type")) or "", "OTHER"),
                "maker": clean(row.get("Provider")),
                "size": clean(row.get("サイズ")),
                "spec_json": {k: v for k, v in spec_json.items() if v},
                "used_in_ai": row.get("AI使用") == "Yes",
                "used_in_mini": row.get("Mini使用") == "Yes",
                "is_active": clean(row.get("Category")) != "古い部品",
            }
            obj, created = PartMaster.objects.update_or_create(
                name=name,
                defaults=defaults,
                create_defaults={**defaults, "part_code": generated_code},
            )
            self._count("PartMaster", "created" if created else "updated")

        # BOMリレーション欠損Parts用のフォールバックマスタ
        PartMaster.objects.get_or_create(
            part_code="UNKNOWN-000",
            defaults={"name": "(BOM未指定)", "category": "OTHER", "is_active": False},
        )

    # ------------------------------------------------------------------
    # 2. 顧客・拠点・拠点設定（サービス管理）
    # ------------------------------------------------------------------

    def _import_customers_sites(self, rows: list[dict[str, str]]) -> None:
        entity_codes: dict[str, str] = {}
        for row in rows:
            location = clean(row["Location"])
            if not location:
                self._count("CustomerSite", "skipped")
                continue

            entity_name = strip_url(row.get("AIBOD Entity", "")) or "未設定"
            entity_num = clean(row.get("EntityNum"))

            if entity_name not in entity_codes:
                entity_codes[entity_name] = entity_num or f"CUST-{len(entity_codes) + 1:03d}"
            elif entity_num and entity_codes[entity_name] != entity_num:
                self._warn(
                    f"顧客「{entity_name}」に複数のEntityNum: "
                    f"{entity_codes[entity_name]} / {entity_num}（拠点 {location}。先勝ち）"
                )
            customer, created = Customer.objects.update_or_create(
                name=entity_name,
                defaults={},
                create_defaults={"code": entity_codes[entity_name]},
            )
            self._count("Customer", "created" if created else "updated")

            note_parts = []
            if entity_num:
                note_parts.append(f"EntityNum: {entity_num}")
            loyverse_shop = clean(row.get("Loyverse店舗名"))
            if loyverse_shop:
                note_parts.append(f"Loyverse店舗名: {loyverse_shop}")

            site, created = CustomerSite.objects.update_or_create(
                name=location,
                customer=customer,
                defaults={
                    "lifecycle_status": LIFECYCLE_MAP.get(
                        clean(row.get("稼働")) or "", "PREPARING"
                    ),
                    "note": "\n".join(note_parts) or None,
                },
            )
            self._count("CustomerSite", "created" if created else "updated")

            config_values = {
                field: clean(row.get(col))
                for col, field in SITECONFIG_COLUMNS.items()
            }
            if any(config_values.values()):
                _, created = SiteConfig.objects.update_or_create(
                    customer_site=site,
                    defaults=config_values,
                )
                self._count("SiteConfig", "created" if created else "updated")

    # ------------------------------------------------------------------
    # 3. 製品モデル
    # ------------------------------------------------------------------

    def _import_product_models(self) -> None:
        for code, name in [
            ("BSTAND-AI", "BAITEN AI"),
            ("BSTAND-MINI", "BAITEN Mini"),
            ("BSTAND-UNKNOWN", "モデル不明（Notion移行）"),
        ]:
            _, created = ProductModel.objects.get_or_create(
                code=code, defaults={"name": name}
            )
            self._count("ProductModel", "created" if created else "updated")

    # ------------------------------------------------------------------
    # 4. BSSセット（Product Set）
    # ------------------------------------------------------------------

    def _set_status(self, model_value: str, katsudo: str) -> str:
        if katsudo in SET_STATUS_MAP:
            return SET_STATUS_MAP[katsudo]
        if "stock" in model_value:
            return "ASSEMBLED"
        if "転用中" in model_value:
            return "RECOVERED"
        if "使用中" in model_value:
            return "INSTALLED"
        return "ASSEMBLED"

    def _import_sets(self, rows: list[dict[str, str]]) -> None:
        models = {m.code: m for m in ProductModel.objects.all()}
        for row in rows:
            set_code = clean(row["Set"])
            if not set_code:
                self._count("BssSet", "skipped")
                continue

            model_value = clean(row.get("Model")) or ""
            if model_value == "BAITEN AI":
                product_model = models["BSTAND-AI"]
            elif model_value == "BAITEN Mini":
                product_model = models["BSTAND-MINI"]
            else:
                product_model = models["BSTAND-UNKNOWN"]

            site = None
            site_name = strip_url(row.get("BAITENサービス管理", ""))
            if site_name:
                site = CustomerSite.objects.filter(name=site_name).first()
                if site is None:
                    self._warn(f"セット {set_code}: 拠点「{site_name}」が見つかりません")

            shipped = parse_date(row.get("出荷日"))
            note_parts = []
            if product_model.code == "BSTAND-UNKNOWN" and model_value:
                note_parts.append(f"Notion Model: {model_value}")

            _, created = BssSet.objects.update_or_create(
                set_code=set_code,
                defaults={
                    "product_model": product_model,
                    "status": self._set_status(model_value, clean(row.get("稼働中")) or ""),
                    "customer_site": site,
                    "installed_at": (
                        timezone.make_aware(datetime.combine(shipped, datetime.min.time()))
                        if shipped
                        else None
                    ),
                    "note": "\n".join(note_parts) or None,
                },
            )
            self._count("BssSet", "created" if created else "updated")

    # ------------------------------------------------------------------
    # 5. 部品実物（Parts）＋ 構成部品
    # ------------------------------------------------------------------

    def _import_part_units(self, rows: list[dict[str, str]]) -> None:
        fallback_master = PartMaster.objects.get(part_code="UNKNOWN-000")
        masters_by_name = {m.name: m for m in PartMaster.objects.all()}
        seen_serials: set[str] = set()

        for row in rows:
            part_name = clean(row["Part"])
            if not part_name:
                self._count("PartUnit", "skipped")
                continue

            serial = part_name
            suffix = 2
            while serial in seen_serials:
                serial = f"{part_name}-{suffix}"
                suffix += 1
            if serial != part_name:
                self._warn(f"Part名重複: {part_name} → {serial} として取込")
            seen_serials.add(serial)

            bom_name = strip_url(row.get("👉BAITEN BOM ", "") or row.get("👉BAITEN BOM", ""))
            master = masters_by_name.get(bom_name)
            if master is None:
                if bom_name:
                    self._warn(f"部品 {part_name}: BOM「{bom_name}」が見つかりません → UNKNOWN")
                master = fallback_master

            set_names = parse_relations(row.get("👉Product Set", ""))
            defect = clean(row.get("不良？")) == "不良"

            note_parts = []
            real_sn = clean(row.get("S/N"))
            if real_sn:
                note_parts.append(f"S/N: {real_sn}")
            target = clean(row.get("👉実用化対象"))
            if target:
                note_parts.append(f"実用化対象: {target}")

            if defect:
                status = "BROKEN"
            elif set_names:
                status = "ASSIGNED"
            else:
                status = "IN_STOCK"

            unit, created = PartUnit.objects.update_or_create(
                serial_number=serial,
                defaults={
                    "part_master": master,
                    "status": status,
                    "purchase_date": parse_date(row.get("👉購入日")),
                    "note": "\n".join(note_parts) or None,
                },
            )
            self._count("PartUnit", "created" if created else "updated")

            if len(set_names) > 1:
                self._warn(f"部品 {part_name}: 複数セットに所属 {set_names}（全てに搭載登録）")
            role = part_name.split("-")[0] if "-" in part_name else None
            for set_name in set_names:
                bss_set = BssSet.objects.filter(set_code=set_name).first()
                if bss_set is None:
                    self._warn(f"部品 {part_name}: セット「{set_name}」が見つかりません")
                    continue
                _, created = BssSetComponent.objects.update_or_create(
                    bss_set=bss_set,
                    part_unit=unit,
                    unmounted_at=None,
                    defaults={
                        "role": role,
                        "mounted_at": bss_set.installed_at or timezone.now(),
                    },
                )
                self._count("BssSetComponent", "created" if created else "updated")

    # ------------------------------------------------------------------
    # 6. SQUARE台帳（PartMaster type=PAYMENT へ吸収）
    # ------------------------------------------------------------------

    def _import_square(self, rows: list[dict[str, str]]) -> None:
        for row in rows:
            name = clean(row.get("Name"))
            if not name:
                continue
            if PartUnit.objects.filter(serial_number=name).exists():
                self._warn(f"SQUARE台帳 {name}: 既にPartsに存在するためスキップ")
                self._count("PartUnit", "skipped")
                continue
            master, _ = PartMaster.objects.get_or_create(
                part_code="SQU-LEDGER",
                defaults={
                    "name": "Square端末（SQUARE台帳由来）",
                    "category": "PAYMENT",
                },
            )
            note = f"S/N: {clean(row.get('S/N'))}" if clean(row.get("S/N")) else None
            PartUnit.objects.update_or_create(
                serial_number=name,
                defaults={
                    "part_master": master,
                    "purchase_date": parse_date(row.get("👉購入日")),
                    "note": note,
                },
            )
            self._count("PartUnit", "created")

    # ------------------------------------------------------------------
    # レポート
    # ------------------------------------------------------------------

    def _report(self, dry_run: bool) -> None:
        mode = "DRY-RUN" if dry_run else "IMPORT"
        self.stdout.write(self.style.MIGRATE_HEADING(f"=== {mode} 結果 ==="))
        for model, counts in self.stats.items():
            self.stdout.write(
                f"  {model:<18} created={counts['created']:<4} "
                f"updated={counts['updated']:<4} skipped={counts['skipped']}"
            )
        if self.warnings:
            self.stdout.write(self.style.WARNING(f"--- 警告 {len(self.warnings)}件 ---"))
            for warning in self.warnings:
                self.stdout.write(self.style.WARNING(f"  {warning}"))
