"""
実セット構成から製品BOM（レシピ）を導出する管理コマンド

Notion移行データには BOM レシピ（ProductBOM）が存在しないため、
実際に組まれたセット（BssSetComponent の搭載中部品）から標準構成を推定する。

導出ロジック:
- 部品コードのプレフィックス（例: MPC-M006 → MPC）を「部品ファミリ」とみなす。
  実データでは MiniPC・ディスプレイ等が互換品番で分散して記録されているため、
  品番単位ではなくファミリ単位で出現率を評価する。
- 構成部品が1件以上あるセットのみを母数とする（構成未入力のセットはデータ欠落として除外）。
- ファミリ出現率 >= required 閾値 → 必須行 / >= optional 閾値 → オプション行。
- 各ファミリの代表品番は搭載数が最多の品番、数量はセットごとの搭載数の最頻値。
  （旧 used_in_ai/mini フラグとの突合は、フラグ廃止＝ProductBOM 正本化に伴い削除）

冪等: (product_model, part_master) の自然キーで update_or_create する。
--replace 指定時は対象モデルの既存BOM行を削除してから登録する。
"""

from collections import Counter, defaultdict
from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from bom.models import PartMaster, ProductBOM, ProductModel


def family_of(part_code: str) -> str:
    """部品コードのファミリ（先頭セグメント）を返す（例: MPC-M006 → MPC）"""
    return part_code.split("-")[0]


class Command(BaseCommand):
    help = "実セット構成（搭載中部品）から製品BOMレシピを導出して登録する"

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="導出結果を表示するのみでDBへ書き込まない",
        )
        parser.add_argument(
            "--replace",
            action="store_true",
            help="対象モデルの既存BOM行を削除してから登録する",
        )
        parser.add_argument(
            "--min-sets",
            type=int,
            default=3,
            help="導出に必要な構成データ付きセットの最小数（既定: 3）",
        )
        parser.add_argument(
            "--required-threshold",
            type=float,
            default=0.5,
            help="必須行とみなすファミリ出現率（既定: 0.5）",
        )
        parser.add_argument(
            "--optional-threshold",
            type=float,
            default=0.2,
            help="オプション行とみなすファミリ出現率（既定: 0.2）",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        dry_run: bool = options["dry_run"]
        replace: bool = options["replace"]
        min_sets: int = options["min_sets"]
        req_th: float = options["required_threshold"]
        opt_th: float = options["optional_threshold"]

        created = updated = deleted = 0

        with transaction.atomic():
            for model in ProductModel.objects.all():
                lines = self._derive_for_model(model, min_sets, req_th, opt_th)
                if lines is None:
                    continue

                if replace:
                    n, _ = ProductBOM.objects.filter(product_model=model).delete()
                    deleted += n

                for line in lines:
                    _, was_created = ProductBOM.objects.update_or_create(
                        product_model=model,
                        part_master=line["part_master"],
                        defaults={
                            "quantity": line["quantity"],
                            "is_optional": line["is_optional"],
                        },
                    )
                    if was_created:
                        created += 1
                    else:
                        updated += 1

            if dry_run:
                transaction.set_rollback(True)

        mode = "（dry-run: 書き込みなし）" if dry_run else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"完了{mode}: created={created} updated={updated} deleted={deleted}"
            )
        )

    def _derive_for_model(
        self,
        model: ProductModel,
        min_sets: int,
        req_th: float,
        opt_th: float,
    ) -> list[dict[str, Any]] | None:
        """1モデル分のBOM行を導出する。導出不能ならNoneを返す"""
        # 構成部品が1件以上あるセットのみ母数にする
        per_set_family_qty: list[dict[str, int]] = []
        variant_units: dict[str, Counter[int]] = defaultdict(Counter)

        for bss_set in model.sets.all():
            components = bss_set.components.filter(
                unmounted_at__isnull=True
            ).select_related("part_unit__part_master")
            family_qty: dict[str, int] = defaultdict(int)
            for comp in components:
                pm = comp.part_unit.part_master
                fam = family_of(pm.part_code)
                family_qty[fam] += 1
                variant_units[fam][pm.id] += 1
            if family_qty:
                per_set_family_qty.append(dict(family_qty))

        n_sets = len(per_set_family_qty)
        self.stdout.write(
            f"\n=== {model.code} ({model.name}): "
            f"構成データ付きセット {n_sets}台 ==="
        )
        if n_sets < min_sets:
            self.stdout.write(
                self.style.WARNING(
                    f"  スキップ: セット数が最小値 {min_sets} 未満"
                )
            )
            return None

        lines: list[dict[str, Any]] = []
        families = sorted({f for fq in per_set_family_qty for f in fq})
        for fam in families:
            quantities = [fq[fam] for fq in per_set_family_qty if fam in fq]
            presence = len(quantities) / n_sets
            if presence < opt_th:
                continue
            modal_qty = Counter(quantities).most_common(1)[0][0]
            representative_id = variant_units[fam].most_common(1)[0][0]
            part = PartMaster.objects.get(id=representative_id)
            is_optional = presence < req_th
            lines.append(
                {
                    "part_master": part,
                    "quantity": modal_qty,
                    "is_optional": is_optional,
                }
            )
            kind = "任意" if is_optional else "必須"
            self.stdout.write(
                f"  [{kind}] {part.part_code:16s} x{modal_qty}  "
                f"出現率 {presence:4.0%}  ({part.name})"
            )

        if not any(not ln["is_optional"] for ln in lines):
            self.stdout.write(
                self.style.WARNING(
                    "  スキップ: 必須行が導出できない（レシピとして不成立）"
                )
            )
            return None
        return lines
