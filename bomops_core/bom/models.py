"""
BOMOps データモデル定義

AIBOD Factory / BOMOps - BOM（部品構成）＋セット＋設置先＋設定情報の一元管理システム
"""

from django.db import models
from django.utils import timezone

from .fields import EncryptedTextField


class TimestampMixin(models.Model):
    """タイムスタンプ用の共通Mixinクラス"""

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="作成日時",
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="更新日時",
    )

    class Meta:
        abstract = True


# =============================================================================
# 2.1 部品マスタ
# =============================================================================


class PartCategory(TimestampMixin):
    """
    部品カテゴリマスタ

    部品の種別（PC/モニター/カメラ等）。ユーザーが画面から追加できる。
    使用中カテゴリの削除は PROTECT で防ぐ。
    """

    name = models.CharField(
        max_length=100,
        unique=True,
        verbose_name="カテゴリ名",
    )

    class Meta:
        db_table = "part_category"
        verbose_name = "部品カテゴリ"
        verbose_name_plural = "部品カテゴリ"
        ordering = ["id"]

    def __str__(self) -> str:
        return self.name


class PartMaster(TimestampMixin):
    """
    部品マスタ

    部品の種類（型番レベル）を管理するマスタテーブル。
    実物個体は PartUnit で管理する。
    """

    class PartGroup(models.TextChoices):
        """部品グループ（正準スキーマの 本体構成品/オプション品/組立部品/その他 に対応）"""

        MAIN = "MAIN", "主要部品"
        PERIPHERAL = "PERIPHERAL", "周辺部品"
        ASSEMBLY = "ASSEMBLY", "組立部品"
        OTHER = "OTHER", "その他"

    part_code = models.CharField(
        max_length=50,
        unique=True,
        verbose_name="部品コード",
        help_text="社内部品コード（例: CAM-USB-001）",
    )
    name = models.CharField(
        max_length=200,
        verbose_name="部品名",
        help_text="部品名（例: USB Camera FullHD）",
    )
    category = models.ForeignKey(
        PartCategory,
        on_delete=models.PROTECT,
        related_name="parts",
        verbose_name="カテゴリ",
    )
    part_group = models.CharField(
        max_length=20,
        choices=PartGroup.choices,
        default=PartGroup.OTHER,
        verbose_name="部品グループ",
        help_text="主要部品/周辺部品/組立部品/その他 の大分類",
    )
    maker = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="メーカー",
    )
    model_number = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="型番",
    )
    spec_json = models.JSONField(
        null=True,
        blank=True,
        verbose_name="スペック情報",
        help_text="解像度やインターフェースなどをJSON形式で保存",
    )
    size = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="サイズ",
    )
    used_in_ai = models.BooleanField(
        default=False,
        verbose_name="AI使用",
        help_text="BAITEN AI モデルで使用する部品",
    )
    used_in_mini = models.BooleanField(
        default=False,
        verbose_name="Mini使用",
        help_text="BAITEN Mini モデルで使用する部品",
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="有効フラグ",
    )

    class Meta:
        db_table = "part_master"
        verbose_name = "部品マスタ"
        verbose_name_plural = "部品マスタ"
        ordering = ["part_code"]

    def __str__(self) -> str:
        return f"{self.part_code}: {self.name}"


class PartUnit(TimestampMixin):
    """
    部品実物（シリアル番号付き）

    部品マスタに対して、実際に存在する1個1個の部品を管理する。
    """

    class Status(models.TextChoices):
        """部品ステータス"""

        IN_STOCK = "IN_STOCK", "在庫"
        ASSIGNED = "ASSIGNED", "割当済"
        BROKEN = "BROKEN", "故障"
        SCRAPPED = "SCRAPPED", "廃棄"

    part_master = models.ForeignKey(
        PartMaster,
        on_delete=models.CASCADE,
        related_name="units",
        verbose_name="部品マスタ",
    )
    serial_number = models.CharField(
        max_length=100,
        unique=True,
        verbose_name="シリアル番号",
    )
    purchase_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="購入日",
    )
    purchase_order_no = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        verbose_name="発注番号",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.IN_STOCK,
        verbose_name="ステータス",
    )
    note = models.TextField(
        null=True,
        blank=True,
        verbose_name="備考",
    )

    class Meta:
        db_table = "part_unit"
        verbose_name = "部品実物"
        verbose_name_plural = "部品実物"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.serial_number} ({self.part_master.part_code})"


# =============================================================================
# 2.2 セットの型番（BOM定義）
# =============================================================================


class ProductModel(TimestampMixin):
    """
    製品モデル（セットの型番/バージョン）

    BAITEN STAND などの製品型番・バージョンを管理。
    どの部品を何個使うかは ProductBOM で定義する。
    """

    code = models.CharField(
        max_length=50,
        unique=True,
        verbose_name="製品コード",
        help_text="例: BSTAND-V1.2",
    )
    name = models.CharField(
        max_length=200,
        verbose_name="製品名",
    )
    description = models.TextField(
        null=True,
        blank=True,
        verbose_name="説明",
    )

    class Meta:
        db_table = "product_model"
        verbose_name = "製品モデル"
        verbose_name_plural = "製品モデル"
        ordering = ["code"]

    def __str__(self) -> str:
        return f"{self.code}: {self.name}"


class ProductBOM(TimestampMixin):
    """
    製品BOM（部品構成表）

    製品モデルに対して、どの部品を何個使うかを定義する。
    """

    product_model = models.ForeignKey(
        ProductModel,
        on_delete=models.CASCADE,
        related_name="bom_items",
        verbose_name="製品モデル",
    )
    part_master = models.ForeignKey(
        PartMaster,
        on_delete=models.CASCADE,
        related_name="bom_usages",
        verbose_name="部品マスタ",
    )
    quantity = models.PositiveIntegerField(
        default=1,
        verbose_name="数量",
    )
    is_optional = models.BooleanField(
        default=False,
        verbose_name="オプション部品",
        help_text="代替・オプション部品の場合はTrue",
    )

    class Meta:
        db_table = "product_bom"
        verbose_name = "製品BOM"
        verbose_name_plural = "製品BOM"
        unique_together = ["product_model", "part_master"]
        ordering = ["product_model", "part_master"]

    def __str__(self) -> str:
        return f"{self.product_model.code} - {self.part_master.part_code} x{self.quantity}"


# =============================================================================
# 2.3 顧客・設置拠点
# =============================================================================


class Customer(TimestampMixin):
    """
    顧客マスタ

    装置を設置する顧客（会社・組織）を管理。
    """

    code = models.CharField(
        max_length=50,
        unique=True,
        verbose_name="顧客コード",
    )
    name = models.CharField(
        max_length=200,
        verbose_name="顧客名",
    )
    contact_person = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="担当者名",
    )
    contact_email = models.EmailField(
        null=True,
        blank=True,
        verbose_name="連絡先メール",
    )
    contact_tel = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        verbose_name="連絡先電話番号",
    )
    note = models.TextField(
        null=True,
        blank=True,
        verbose_name="備考",
    )

    class Meta:
        db_table = "customer"
        verbose_name = "顧客"
        verbose_name_plural = "顧客"
        ordering = ["code"]

    def __str__(self) -> str:
        return f"{self.code}: {self.name}"


class CustomerSite(TimestampMixin):
    """
    顧客拠点

    顧客ごとの設置拠点（工場食堂・売店など）を管理。
    """

    class LifecycleStatus(models.TextChoices):
        """拠点ライフサイクル状態"""

        PREPARING = "PREPARING", "準備中"
        ACTIVE = "ACTIVE", "稼働中"
        WITHDRAWN = "WITHDRAWN", "撤退済"
        BASE = "BASE", "拠点"
        LOANED = "LOANED", "貸出中"

    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="sites",
        verbose_name="顧客",
    )
    name = models.CharField(
        max_length=200,
        verbose_name="拠点名",
        help_text="例: ○○工場売店",
    )
    lifecycle_status = models.CharField(
        max_length=20,
        choices=LifecycleStatus.choices,
        default=LifecycleStatus.PREPARING,
        verbose_name="ライフサイクル状態",
    )
    address = models.CharField(
        max_length=500,
        null=True,
        blank=True,
        verbose_name="住所",
    )
    timezone = models.CharField(
        max_length=50,
        default="Asia/Tokyo",
        verbose_name="タイムゾーン",
    )
    note = models.TextField(
        null=True,
        blank=True,
        verbose_name="備考",
    )

    class Meta:
        db_table = "customer_site"
        verbose_name = "顧客拠点"
        verbose_name_plural = "顧客拠点"
        ordering = ["customer", "name"]

    def __str__(self) -> str:
        return f"{self.customer.name} - {self.name}"


class SiteConfig(TimestampMixin):
    """
    拠点設定情報（CustomerSite と 1:1）

    POS・決済・通知など拠点固有のクレデンシャル/設定を管理する。
    token / secret 系は EncryptedTextField で暗号化保存し、
    APIレスポンスではマスクして返す（CLAUDE.md §4.1）。
    """

    customer_site = models.OneToOneField(
        CustomerSite,
        on_delete=models.CASCADE,
        related_name="config",
        verbose_name="顧客拠点",
    )
    # --- Loyverse (POS) ---
    loyverse_account = models.CharField(
        max_length=200,
        null=True,
        blank=True,
        verbose_name="Loyverseアカウント",
    )
    loyverse_store_id = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="Loyverse店舗ID",
    )
    loyverse_token = EncryptedTextField(
        null=True,
        blank=True,
        verbose_name="Loyverseトークン",
    )
    # --- Square (決済) ---
    square_account = models.CharField(
        max_length=200,
        null=True,
        blank=True,
        verbose_name="Squareアカウント",
    )
    squ_device_id = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="SquareデバイスID",
    )
    squ_location_id = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="SquareロケーションID",
    )
    squ_token = EncryptedTextField(
        null=True,
        blank=True,
        verbose_name="Squareトークン",
    )
    # --- その他クレデンシャル ---
    paypay_secret = EncryptedTextField(
        null=True,
        blank=True,
        verbose_name="PayPayシークレット",
    )
    baiten_cloud_key = EncryptedTextField(
        null=True,
        blank=True,
        verbose_name="BAITENクラウドキー",
    )
    google_secret = EncryptedTextField(
        null=True,
        blank=True,
        verbose_name="Googleシークレット",
    )
    slack_bot_token = EncryptedTextField(
        null=True,
        blank=True,
        verbose_name="Slack Botトークン",
    )
    # --- 設定ファイル ---
    config_toml = models.TextField(
        null=True,
        blank=True,
        verbose_name="config.toml",
        help_text="端末に配布する config.toml の内容",
    )
    baiten_env = models.TextField(
        null=True,
        blank=True,
        verbose_name="baiten.env",
        help_text="端末に配布する環境変数ファイルの内容",
    )

    class Meta:
        db_table = "site_config"
        verbose_name = "拠点設定"
        verbose_name_plural = "拠点設定"
        ordering = ["customer_site"]

    def __str__(self) -> str:
        return f"SiteConfig: {self.customer_site}"

    SECRET_FIELDS = [
        "loyverse_token",
        "squ_token",
        "paypay_secret",
        "baiten_cloud_key",
        "google_secret",
        "slack_bot_token",
    ]


# =============================================================================
# 2.4 実際のセット（完成機1台）
# =============================================================================


class BssSet(TimestampMixin):
    """
    BSSセット（BAITEN STAND 実機1台）

    実際に組み立てられた装置1台を管理。
    どの部品が搭載されているかは BssSetComponent で管理。
    """

    class Status(models.TextChoices):
        """セットステータス"""

        ASSEMBLED = "ASSEMBLED", "組立完了"
        INSTALLED = "INSTALLED", "設置済"
        REPAIR = "REPAIR", "修理中"
        RECOVERED = "RECOVERED", "回収済"
        SCRAPPED = "SCRAPPED", "廃棄"

    set_code = models.CharField(
        max_length=50,
        unique=True,
        verbose_name="セットコード",
        help_text="例: BST-2025-0010",
    )
    product_model = models.ForeignKey(
        ProductModel,
        on_delete=models.PROTECT,
        related_name="sets",
        verbose_name="製品モデル",
        help_text="どのBOMで組んだか",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ASSEMBLED,
        verbose_name="ステータス",
    )
    customer_site = models.ForeignKey(
        CustomerSite,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sets",
        verbose_name="設置拠点",
    )
    installed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="設置日時",
    )
    removed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="撤去日時",
    )
    note = models.TextField(
        null=True,
        blank=True,
        verbose_name="備考",
    )

    class Meta:
        db_table = "bss_set"
        verbose_name = "BSSセット"
        verbose_name_plural = "BSSセット"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.set_code} ({self.product_model.code})"


class BssSetComponent(TimestampMixin):
    """
    BSSセット構成部品

    セットに搭載されている部品実物を管理。
    部品の搭載・取り外し履歴も管理可能。
    """

    bss_set = models.ForeignKey(
        BssSet,
        on_delete=models.CASCADE,
        related_name="components",
        verbose_name="BSSセット",
    )
    part_unit = models.ForeignKey(
        PartUnit,
        on_delete=models.PROTECT,
        related_name="set_assignments",
        verbose_name="部品実物",
    )
    role = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        verbose_name="役割",
        help_text="例: MAIN_PC, CAMERA1, PAYMENT",
    )
    mounted_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="搭載日時",
        default=timezone.now,
    )
    unmounted_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="取り外し日時",
    )
    note = models.TextField(
        null=True,
        blank=True,
        verbose_name="備考",
    )

    class Meta:
        db_table = "bss_set_component"
        verbose_name = "BSSセット構成部品"
        verbose_name_plural = "BSSセット構成部品"
        ordering = ["bss_set", "role"]

    def __str__(self) -> str:
        return f"{self.bss_set.set_code} - {self.role}: {self.part_unit.serial_number}"

    @property
    def is_mounted(self) -> bool:
        """現在搭載中かどうか"""
        return self.mounted_at is not None and self.unmounted_at is None


# =============================================================================
# 2.5 コンフィグ情報
# =============================================================================


class BssSetConfig(TimestampMixin):
    """
    BSSセット設定情報

    POS / PayPay / ネットワークなど、セットごとの設定情報を管理。
    """

    bss_set = models.ForeignKey(
        BssSet,
        on_delete=models.CASCADE,
        related_name="configs",
        verbose_name="BSSセット",
    )
    config_group = models.CharField(
        max_length=50,
        verbose_name="設定グループ",
        help_text="例: POS, PAYPAY, NETWORK, SYSTEM",
    )
    key = models.CharField(
        max_length=100,
        verbose_name="設定キー",
        help_text="例: paypay_merchant_id, pos_store_id",
    )
    value = models.TextField(
        null=True,
        blank=True,
        verbose_name="設定値",
    )
    value_json = models.JSONField(
        null=True,
        blank=True,
        verbose_name="設定値(JSON)",
        help_text="複雑な設定を入れる場所",
    )
    is_secret = models.BooleanField(
        default=False,
        verbose_name="秘匿情報",
        help_text="APIキーなど秘匿情報の場合はTrue",
    )
    valid_from = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="有効開始日時",
    )
    valid_to = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="有効終了日時",
    )

    class Meta:
        db_table = "bss_set_config"
        verbose_name = "BSSセット設定"
        verbose_name_plural = "BSSセット設定"
        ordering = ["bss_set", "config_group", "key"]
        indexes = [
            models.Index(fields=["bss_set", "config_group"]),
            models.Index(fields=["bss_set", "key"]),
        ]

    def __str__(self) -> str:
        return f"{self.bss_set.set_code} - {self.config_group}.{self.key}"

    @property
    def is_valid(self) -> bool:
        """現在有効かどうか"""
        now = timezone.now()
        if self.valid_from and now < self.valid_from:
            return False
        if self.valid_to and now >= self.valid_to:
            return False
        return True


# =============================================================================
# 2.6 運用履歴（Operations Layer — 追記型イベント）
# =============================================================================


class MaintenanceEvent(TimestampMixin):
    """
    保守イベント（追記型履歴）

    故障・交換・点検・設定変更の履歴を追記する。
    Dynamic BOM の本質として履歴は上書き・削除しない（CLAUDE.md §4.3）。
    """

    class EventType(models.TextChoices):
        """保守イベント種別"""

        FAILURE = "FAILURE", "故障"
        REPLACEMENT = "REPLACEMENT", "交換"
        INSPECTION = "INSPECTION", "点検"
        CONFIG_CHANGE = "CONFIG_CHANGE", "設定変更"

    bss_set = models.ForeignKey(
        BssSet,
        on_delete=models.PROTECT,
        related_name="maintenance_events",
        verbose_name="BSSセット",
    )
    part_unit = models.ForeignKey(
        PartUnit,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="maintenance_events",
        verbose_name="対象部品実物",
    )
    event_type = models.CharField(
        max_length=20,
        choices=EventType.choices,
        verbose_name="イベント種別",
    )
    note = models.TextField(
        null=True,
        blank=True,
        verbose_name="備考",
    )
    occurred_at = models.DateTimeField(
        default=timezone.now,
        verbose_name="発生日時",
    )

    class Meta:
        db_table = "maintenance_event"
        verbose_name = "保守イベント"
        verbose_name_plural = "保守イベント"
        ordering = ["-occurred_at"]
        indexes = [
            models.Index(fields=["bss_set", "occurred_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.bss_set.set_code} - {self.get_event_type_display()} @ {self.occurred_at:%Y-%m-%d}"


class DeployEvent(TimestampMixin):
    """
    導入イベント（追記型履歴）

    設置・開通・稼働・回収・再組立のオペレーション履歴を追記する。
    履歴は上書き・削除しない（CLAUDE.md §4.3）。
    """

    class Stage(models.TextChoices):
        """導入ステージ"""

        INSTALL = "INSTALL", "設置"
        ACTIVATION = "ACTIVATION", "開通"
        OPERATION = "OPERATION", "稼働"
        RECOVERY = "RECOVERY", "回収"
        REASSEMBLY = "REASSEMBLY", "再組立"

    bss_set = models.ForeignKey(
        BssSet,
        on_delete=models.PROTECT,
        related_name="deploy_events",
        verbose_name="BSSセット",
    )
    stage = models.CharField(
        max_length=20,
        choices=Stage.choices,
        verbose_name="ステージ",
    )
    note = models.TextField(
        null=True,
        blank=True,
        verbose_name="備考",
    )
    occurred_at = models.DateTimeField(
        default=timezone.now,
        verbose_name="発生日時",
    )

    class Meta:
        db_table = "deploy_event"
        verbose_name = "導入イベント"
        verbose_name_plural = "導入イベント"
        ordering = ["-occurred_at"]
        indexes = [
            models.Index(fields=["bss_set", "occurred_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.bss_set.set_code} - {self.get_stage_display()} @ {self.occurred_at:%Y-%m-%d}"


# =============================================================================
# 2.7 外部連携（External / Reference）
# =============================================================================


class EquipmentRef(TimestampMixin):
    """
    機器管理DB連携参照

    L4 機器管理DB（Notion 183e91a9）のレコードと部品実物の N:M 対応を管理する。
    """

    external_id = models.CharField(
        max_length=100,
        unique=True,
        verbose_name="外部ID",
        help_text="L4 機器管理DBのレコードID",
    )
    name = models.CharField(
        max_length=200,
        null=True,
        blank=True,
        verbose_name="機器名",
    )
    part_units = models.ManyToManyField(
        PartUnit,
        blank=True,
        related_name="equipment_refs",
        verbose_name="部品実物",
    )

    class Meta:
        db_table = "equipment_ref"
        verbose_name = "機器管理参照"
        verbose_name_plural = "機器管理参照"
        ordering = ["external_id"]

    def __str__(self) -> str:
        return f"{self.external_id}: {self.name or '(no name)'}"
