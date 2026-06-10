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
    PartMaster,
    PartUnit,
    ProductBOM,
    ProductModel,
)


# =============================================================================
# 部品マスタ
# =============================================================================


class PartMasterSerializer(serializers.ModelSerializer):
    """部品マスタシリアライザ"""

    category_display = serializers.CharField(
        source="get_category_display",
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
            "maker",
            "model_number",
            "spec_json",
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


class ProductModelSerializer(serializers.ModelSerializer):
    """製品モデルシリアライザ"""

    class Meta:
        model = ProductModel
        fields = [
            "id",
            "code",
            "name",
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

    class Meta:
        model = CustomerSite
        fields = [
            "id",
            "customer",
            "customer_name",
            "name",
            "address",
            "timezone",
            "note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


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

    serial_number = serializers.CharField()
    part_master = serializers.CharField()
    current_set = serializers.DictField(allow_null=True)
    current_site = serializers.DictField(allow_null=True)
