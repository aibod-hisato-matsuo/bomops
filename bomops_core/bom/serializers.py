"""
BOMOps API シリアライザ定義

Django REST Frameworkのシリアライザを定義。
"""

from typing import Any

from rest_framework import serializers

from .models import (
    BssSet,
    BssSetComponent,
    BssSetConfig,
    Customer,
    CustomerSite,
    DeployEvent,
    EquipmentRef,
    MaintenanceEvent,
    PartCategory,
    PartMaster,
    PartUnit,
    ProductBOM,
    ProductFamily,
    ProductModel,
    SiteConfig,
)


# =============================================================================
# 部品マスタ
# =============================================================================


class PartCategorySerializer(serializers.ModelSerializer):
    """部品カテゴリシリアライザ"""

    class Meta:
        model = PartCategory
        fields = ["id", "name", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class PartMasterCategorySummarySerializer(serializers.Serializer):
    """部品マスタ: グループ×カテゴリの件数集計（読み取り専用）"""

    part_group = serializers.CharField()
    category = serializers.CharField()
    count = serializers.IntegerField()


class PartMasterUsedInSerializer(serializers.ModelSerializer):
    """部品マスタ: 使用先製品モデル（ProductBOM 由来・読み取り専用）"""

    code = serializers.CharField(source="product_model.code", read_only=True)
    name = serializers.CharField(source="product_model.name", read_only=True)
    family = serializers.CharField(
        source="product_model.family.name",
        read_only=True,
        allow_null=True,
        default=None,
    )
    grade = serializers.CharField(
        source="product_model.grade",
        read_only=True,
        allow_null=True,
    )
    variation = serializers.CharField(
        source="product_model.variation",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = ProductBOM
        fields = [
            "product_model",
            "code",
            "name",
            "family",
            "grade",
            "variation",
            "quantity",
            "is_optional",
        ]
        read_only_fields = fields


class PartMasterSerializer(serializers.ModelSerializer):
    """部品マスタシリアライザ"""

    category_display = serializers.CharField(
        source="category.name",
        read_only=True,
    )
    used_in = PartMasterUsedInSerializer(
        source="bom_usages",
        many=True,
        read_only=True,
    )
    part_group_display = serializers.CharField(
        source="get_part_group_display",
        read_only=True,
    )

    class Meta:
        model = PartMaster
        fields = [
            "id",
            "part_code",
            "name",
            "category",
            "category_display",
            "part_group",
            "part_group_display",
            "maker",
            "model_number",
            "spec_json",
            "size",
            "used_in",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class PartUnitSerializer(serializers.ModelSerializer):
    """部品実物シリアライザ"""

    part_master_code = serializers.CharField(
        source="part_master.part_code",
        read_only=True,
    )
    part_master_name = serializers.CharField(
        source="part_master.name",
        read_only=True,
    )
    status_display = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )

    class Meta:
        model = PartUnit
        fields = [
            "id",
            "part_master",
            "part_master_code",
            "part_master_name",
            "serial_number",
            "purchase_date",
            "purchase_order_no",
            "status",
            "status_display",
            "note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


# =============================================================================
# 製品モデル・BOM
# =============================================================================


class ProductFamilySerializer(serializers.ModelSerializer):
    """製品ファミリシリアライザ"""

    class Meta:
        model = ProductFamily
        fields = ["id", "name", "description", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class ProductModelHierarchySummarySerializer(serializers.Serializer):
    """製品モデル: ファミリ×グレード×バリエーションの件数集計（読み取り専用）"""

    family = serializers.CharField(allow_null=True)
    grade = serializers.CharField(allow_null=True)
    variation = serializers.CharField(allow_null=True)
    count = serializers.IntegerField()


class ProductModelSerializer(serializers.ModelSerializer):
    """製品モデルシリアライザ"""

    family_name = serializers.CharField(
        source="family.name",
        read_only=True,
        allow_null=True,
        default=None,
    )

    class Meta:
        model = ProductModel
        fields = [
            "id",
            "code",
            "name",
            "family",
            "family_name",
            "grade",
            "variation",
            "description",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ProductBOMSerializer(serializers.ModelSerializer):
    """製品BOMシリアライザ"""

    product_model_code = serializers.CharField(
        source="product_model.code",
        read_only=True,
    )
    part_master_code = serializers.CharField(
        source="part_master.part_code",
        read_only=True,
    )
    part_master_name = serializers.CharField(
        source="part_master.name",
        read_only=True,
    )

    class Meta:
        model = ProductBOM
        fields = [
            "id",
            "product_model",
            "product_model_code",
            "part_master",
            "part_master_code",
            "part_master_name",
            "quantity",
            "is_optional",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


# =============================================================================
# 顧客・拠点
# =============================================================================


class CustomerSerializer(serializers.ModelSerializer):
    """顧客シリアライザ"""

    sites_count = serializers.IntegerField(
        source="sites.count",
        read_only=True,
    )

    class Meta:
        model = Customer
        fields = [
            "id",
            "code",
            "name",
            "contact_person",
            "contact_email",
            "contact_tel",
            "note",
            "sites_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class CustomerSiteSerializer(serializers.ModelSerializer):
    """顧客拠点シリアライザ"""

    customer_name = serializers.CharField(
        source="customer.name",
        read_only=True,
    )
    lifecycle_status_display = serializers.CharField(
        source="get_lifecycle_status_display",
        read_only=True,
    )

    class Meta:
        model = CustomerSite
        fields = [
            "id",
            "customer",
            "customer_name",
            "name",
            "address",
            "timezone",
            "lifecycle_status",
            "lifecycle_status_display",
            "note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class SiteConfigSerializer(serializers.ModelSerializer):
    """拠点設定シリアライザ

    token / secret 系フィールドは書き込み可能だが、
    レスポンスでは必ずマスクして返す（CLAUDE.md §4.1）。
    """

    customer_site_name = serializers.CharField(
        source="customer_site.name",
        read_only=True,
    )

    class Meta:
        model = SiteConfig
        fields = [
            "id",
            "customer_site",
            "customer_site_name",
            "loyverse_account",
            "loyverse_store_id",
            "loyverse_token",
            "square_account",
            "squ_device_id",
            "squ_location_id",
            "squ_token",
            "paypay_secret",
            "baiten_cloud_key",
            "google_secret",
            "slack_bot_token",
            "config_toml",
            "baiten_env",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    @staticmethod
    def _mask(value: str | None) -> str | None:
        if not value:
            return value
        return "****" + value[-4:] if len(value) > 4 else "****"

    def to_representation(self, instance: SiteConfig) -> dict[str, Any]:
        data = super().to_representation(instance)
        for field in SiteConfig.SECRET_FIELDS:
            data[field] = self._mask(data.get(field))
        return data


# =============================================================================
# BSSセット
# =============================================================================


class BssSetSerializer(serializers.ModelSerializer):
    """BSSセットシリアライザ"""

    product_model_code = serializers.CharField(
        source="product_model.code",
        read_only=True,
    )
    product_model_name = serializers.CharField(
        source="product_model.name",
        read_only=True,
    )
    customer_site_name = serializers.CharField(
        source="customer_site.name",
        read_only=True,
    )
    customer_name = serializers.CharField(
        source="customer_site.customer.name",
        read_only=True,
    )
    status_display = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )
    components_count = serializers.IntegerField(
        source="components.count",
        read_only=True,
    )

    class Meta:
        model = BssSet
        fields = [
            "id",
            "set_code",
            "product_model",
            "product_model_code",
            "product_model_name",
            "status",
            "status_display",
            "customer_site",
            "customer_site_name",
            "customer_name",
            "installed_at",
            "removed_at",
            "note",
            "components_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class BssSetComponentSerializer(serializers.ModelSerializer):
    """BSSセット構成部品シリアライザ"""

    set_code = serializers.CharField(
        source="bss_set.set_code",
        read_only=True,
    )
    serial_number = serializers.CharField(
        source="part_unit.serial_number",
        read_only=True,
    )
    part_code = serializers.CharField(
        source="part_unit.part_master.part_code",
        read_only=True,
    )
    part_name = serializers.CharField(
        source="part_unit.part_master.name",
        read_only=True,
    )
    is_mounted = serializers.BooleanField(read_only=True)

    class Meta:
        model = BssSetComponent
        fields = [
            "id",
            "bss_set",
            "set_code",
            "part_unit",
            "serial_number",
            "part_code",
            "part_name",
            "role",
            "mounted_at",
            "unmounted_at",
            "is_mounted",
            "note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class BssSetConfigSerializer(serializers.ModelSerializer):
    """BSSセット設定シリアライザ"""

    set_code = serializers.CharField(
        source="bss_set.set_code",
        read_only=True,
    )
    is_valid = serializers.BooleanField(read_only=True)
    # 秘匿情報はAPIでマスクする
    masked_value = serializers.SerializerMethodField()

    class Meta:
        model = BssSetConfig
        fields = [
            "id",
            "bss_set",
            "set_code",
            "config_group",
            "key",
            "value",
            "masked_value",
            "value_json",
            "is_secret",
            "valid_from",
            "valid_to",
            "is_valid",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_masked_value(self, obj: BssSetConfig) -> str | None:
        """秘匿情報の場合はマスクした値を返す"""
        if obj.is_secret and obj.value:
            return "****" + obj.value[-4:] if len(obj.value) > 4 else "****"
        return obj.value


# =============================================================================
# 運用履歴（Operations Layer — 追記型イベント）
# =============================================================================


class MaintenanceEventSerializer(serializers.ModelSerializer):
    """保守イベントシリアライザ（追記型）"""

    set_code = serializers.CharField(
        source="bss_set.set_code",
        read_only=True,
    )
    serial_number = serializers.SerializerMethodField()
    event_type_display = serializers.CharField(
        source="get_event_type_display",
        read_only=True,
    )

    class Meta:
        model = MaintenanceEvent
        fields = [
            "id",
            "bss_set",
            "set_code",
            "part_unit",
            "serial_number",
            "event_type",
            "event_type_display",
            "note",
            "occurred_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_serial_number(self, obj: MaintenanceEvent) -> str | None:
        """対象部品実物のシリアル番号（部品指定なしの場合はNone）"""
        return obj.part_unit.serial_number if obj.part_unit else None


class DeployEventSerializer(serializers.ModelSerializer):
    """導入イベントシリアライザ（追記型）"""

    set_code = serializers.CharField(
        source="bss_set.set_code",
        read_only=True,
    )
    stage_display = serializers.CharField(
        source="get_stage_display",
        read_only=True,
    )

    class Meta:
        model = DeployEvent
        fields = [
            "id",
            "bss_set",
            "set_code",
            "stage",
            "stage_display",
            "note",
            "occurred_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


# =============================================================================
# 外部連携
# =============================================================================


class EquipmentRefSerializer(serializers.ModelSerializer):
    """機器管理参照シリアライザ"""

    part_unit_serials = serializers.SlugRelatedField(
        source="part_units",
        slug_field="serial_number",
        many=True,
        read_only=True,
    )

    class Meta:
        model = EquipmentRef
        fields = [
            "id",
            "external_id",
            "name",
            "part_units",
            "part_unit_serials",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


# =============================================================================
# カスタムAPI用シリアライザ
# =============================================================================


class ComponentDetailSerializer(serializers.Serializer):
    """セット構成詳細用シリアライザ（読み取り専用）"""

    role = serializers.CharField()
    part_code = serializers.CharField()
    serial_number = serializers.CharField()


class BssSetCompositionSerializer(serializers.Serializer):
    """セット構成ビュー用シリアライザ（読み取り専用）"""

    set_id = serializers.IntegerField()
    set_code = serializers.CharField()
    product_model = serializers.CharField()
    components = ComponentDetailSerializer(many=True)


class EffectiveConfigSerializer(serializers.Serializer):
    """有効なコンフィグ一覧用シリアライザ（読み取り専用）"""

    config_group = serializers.CharField()
    key = serializers.CharField()
    value = serializers.CharField(allow_null=True)
    value_json = serializers.JSONField(allow_null=True)
    is_secret = serializers.BooleanField()
    valid_from = serializers.DateTimeField(allow_null=True)
    valid_to = serializers.DateTimeField(allow_null=True)


class LookupBySerialSerializer(serializers.Serializer):
    """シリアル番号逆引き用シリアライザ（読み取り専用）"""

    part_unit_id = serializers.IntegerField()
    serial_number = serializers.CharField()
    part_master = serializers.CharField()
    current_set = serializers.DictField(allow_null=True)
    current_site = serializers.DictField(allow_null=True)


class PartUnitHistoryEntrySerializer(serializers.Serializer):
    """部品使用履歴タイムライン1件分のシリアライザ（読み取り専用）"""

    kind = serializers.ChoiceField(
        choices=["PURCHASED", "MOUNTED", "UNMOUNTED", "MAINTENANCE"],
    )
    occurred_at = serializers.DateTimeField()
    set_code = serializers.CharField(allow_null=True)
    role = serializers.CharField(allow_null=True)
    event_type = serializers.CharField(allow_null=True)
    event_type_display = serializers.CharField(allow_null=True)
    note = serializers.CharField(allow_null=True)
    purchase_order_no = serializers.CharField(allow_null=True)


class PartUnitHistorySerializer(serializers.Serializer):
    """部品使用履歴レスポンスのシリアライザ（読み取り専用）"""

    part_unit = serializers.DictField()
    timeline = PartUnitHistoryEntrySerializer(many=True)


class DashboardSetsSummarySerializer(serializers.Serializer):
    """ダッシュボード: セット集計"""

    total = serializers.IntegerField()
    by_status = serializers.DictField(child=serializers.IntegerField())


class DashboardPartUnitsSummarySerializer(serializers.Serializer):
    """ダッシュボード: 部品実物集計"""

    total = serializers.IntegerField()
    by_status = serializers.DictField(child=serializers.IntegerField())
    by_category = serializers.DictField(child=serializers.IntegerField())


class DashboardSitesSummarySerializer(serializers.Serializer):
    """ダッシュボード: 拠点集計"""

    total = serializers.IntegerField()
    by_lifecycle_status = serializers.DictField(child=serializers.IntegerField())


class DashboardCustomersSummarySerializer(serializers.Serializer):
    """ダッシュボード: 顧客集計"""

    total = serializers.IntegerField()


class DashboardTotalSerializer(serializers.Serializer):
    """ダッシュボード: 総数のみの集計（マスタ系）"""

    total = serializers.IntegerField()


class DashboardStockCoverageSerializer(serializers.Serializer):
    """ダッシュボード: 製品モデル別の在庫組立可能数"""

    product_model_id = serializers.IntegerField()
    product_model_code = serializers.CharField()
    product_model_name = serializers.CharField()
    buildable = serializers.IntegerField()
    bottleneck_part_code = serializers.CharField()
    bottleneck_part_name = serializers.CharField()
    bottleneck_stock = serializers.IntegerField()
    bottleneck_required = serializers.IntegerField()


class DashboardSummarySerializer(serializers.Serializer):
    """ダッシュボードサマリーのシリアライザ（読み取り専用）"""

    sets = DashboardSetsSummarySerializer()
    part_units = DashboardPartUnitsSummarySerializer()
    sites = DashboardSitesSummarySerializer()
    customers = DashboardCustomersSummarySerializer()
    part_masters = DashboardTotalSerializer()
    product_models = DashboardTotalSerializer()
    stock_coverage = DashboardStockCoverageSerializer(many=True)
