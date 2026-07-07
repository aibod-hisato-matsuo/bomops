"""
BOMOps Django Admin 設定

すべてのモデルを管理画面で運用できるよう設定。
"""

from django.contrib import admin
from django.db.models import Count
from django.utils.html import format_html

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
    ProductModel,
    SiteConfig,
)


# =============================================================================
# 部品マスタ
# =============================================================================


@admin.register(PartCategory)
class PartCategoryAdmin(admin.ModelAdmin):
    """部品カテゴリ管理"""

    list_display = ["name", "part_count", "created_at"]
    search_fields = ["name"]
    readonly_fields = ["created_at", "updated_at"]

    @admin.display(description="部品数")
    def part_count(self, obj: PartCategory) -> int:
        return obj.parts.count()


@admin.register(PartMaster)
class PartMasterAdmin(admin.ModelAdmin):
    """部品マスタ管理"""

    list_display = [
        "part_code",
        "name",
        "category",
        "part_group",
        "maker",
        "model_number",
        "is_active",
        "unit_count",
        "created_at",
    ]
    list_filter = ["part_group", "category", "is_active", "maker"]
    search_fields = ["part_code", "name", "model_number", "maker"]
    ordering = ["part_code"]
    readonly_fields = ["created_at", "updated_at"]

    fieldsets = [
        ("基本情報", {
            "fields": ["part_code", "name", "category", "is_active"],
        }),
        ("製品情報", {
            "fields": ["maker", "model_number", "spec_json", "size"],
        }),
        ("使用モデル", {
            "fields": ["used_in_ai", "used_in_mini"],
        }),
        ("システム情報", {
            "fields": ["created_at", "updated_at"],
            "classes": ["collapse"],
        }),
    ]

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            _unit_count=Count("units")
        )

    @admin.display(description="実物数", ordering="_unit_count")
    def unit_count(self, obj):
        return obj._unit_count


@admin.register(PartUnit)
class PartUnitAdmin(admin.ModelAdmin):
    """部品実物管理"""

    list_display = [
        "serial_number",
        "part_master",
        "status",
        "purchase_date",
        "purchase_order_no",
        "created_at",
    ]
    list_filter = ["status", "part_master__category", "purchase_date"]
    search_fields = ["serial_number", "part_master__part_code", "part_master__name"]
    ordering = ["-created_at"]
    readonly_fields = ["created_at", "updated_at"]
    autocomplete_fields = ["part_master"]

    fieldsets = [
        ("基本情報", {
            "fields": ["part_master", "serial_number", "status"],
        }),
        ("購入情報", {
            "fields": ["purchase_date", "purchase_order_no"],
        }),
        ("その他", {
            "fields": ["note"],
        }),
        ("システム情報", {
            "fields": ["created_at", "updated_at"],
            "classes": ["collapse"],
        }),
    ]


# =============================================================================
# 製品モデル・BOM
# =============================================================================


class ProductBOMInline(admin.TabularInline):
    """製品BOMインライン"""

    model = ProductBOM
    extra = 1
    autocomplete_fields = ["part_master"]


@admin.register(ProductModel)
class ProductModelAdmin(admin.ModelAdmin):
    """製品モデル管理"""

    list_display = [
        "code",
        "name",
        "bom_count",
        "set_count",
        "created_at",
    ]
    search_fields = ["code", "name"]
    ordering = ["code"]
    readonly_fields = ["created_at", "updated_at"]
    inlines = [ProductBOMInline]

    fieldsets = [
        ("基本情報", {
            "fields": ["code", "name", "description"],
        }),
        ("システム情報", {
            "fields": ["created_at", "updated_at"],
            "classes": ["collapse"],
        }),
    ]

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            _bom_count=Count("bom_items", distinct=True),
            _set_count=Count("sets", distinct=True),
        )

    @admin.display(description="BOM部品数", ordering="_bom_count")
    def bom_count(self, obj):
        return obj._bom_count

    @admin.display(description="セット数", ordering="_set_count")
    def set_count(self, obj):
        return obj._set_count


@admin.register(ProductBOM)
class ProductBOMAdmin(admin.ModelAdmin):
    """製品BOM管理"""

    list_display = [
        "product_model",
        "part_master",
        "quantity",
        "is_optional",
    ]
    list_filter = ["product_model", "is_optional"]
    search_fields = [
        "product_model__code",
        "product_model__name",
        "part_master__part_code",
        "part_master__name",
    ]
    ordering = ["product_model", "part_master"]
    autocomplete_fields = ["product_model", "part_master"]


# =============================================================================
# 顧客・拠点
# =============================================================================


class CustomerSiteInline(admin.TabularInline):
    """顧客拠点インライン"""

    model = CustomerSite
    extra = 1


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    """顧客管理"""

    list_display = [
        "code",
        "name",
        "contact_person",
        "contact_email",
        "contact_tel",
        "site_count",
        "created_at",
    ]
    search_fields = ["code", "name", "contact_person", "contact_email"]
    ordering = ["code"]
    readonly_fields = ["created_at", "updated_at"]
    inlines = [CustomerSiteInline]

    fieldsets = [
        ("基本情報", {
            "fields": ["code", "name"],
        }),
        ("連絡先", {
            "fields": ["contact_person", "contact_email", "contact_tel"],
        }),
        ("その他", {
            "fields": ["note"],
        }),
        ("システム情報", {
            "fields": ["created_at", "updated_at"],
            "classes": ["collapse"],
        }),
    ]

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            _site_count=Count("sites")
        )

    @admin.display(description="拠点数", ordering="_site_count")
    def site_count(self, obj):
        return obj._site_count


@admin.register(CustomerSite)
class CustomerSiteAdmin(admin.ModelAdmin):
    """顧客拠点管理"""

    list_display = [
        "name",
        "customer",
        "lifecycle_status",
        "address",
        "timezone",
        "set_count",
        "created_at",
    ]
    list_filter = ["lifecycle_status", "customer", "timezone"]
    search_fields = ["name", "address", "customer__name"]
    ordering = ["customer", "name"]
    readonly_fields = ["created_at", "updated_at"]
    autocomplete_fields = ["customer"]

    fieldsets = [
        ("基本情報", {
            "fields": ["customer", "name", "lifecycle_status", "address", "timezone"],
        }),
        ("その他", {
            "fields": ["note"],
        }),
        ("システム情報", {
            "fields": ["created_at", "updated_at"],
            "classes": ["collapse"],
        }),
    ]

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            _set_count=Count("sets")
        )

    @admin.display(description="設置セット数", ordering="_set_count")
    def set_count(self, obj):
        return obj._set_count


# =============================================================================
# BSSセット
# =============================================================================


class BssSetComponentInline(admin.TabularInline):
    """BSSセット構成部品インライン"""

    model = BssSetComponent
    extra = 1
    autocomplete_fields = ["part_unit"]
    readonly_fields = ["is_mounted_display"]

    @admin.display(description="搭載中")
    def is_mounted_display(self, obj):
        if obj.pk and obj.is_mounted:
            return format_html('<span style="color: green;">●</span>')
        return format_html('<span style="color: gray;">○</span>')


class BssSetConfigInline(admin.TabularInline):
    """BSSセット設定インライン"""

    model = BssSetConfig
    extra = 1
    readonly_fields = ["masked_value"]

    @admin.display(description="マスク値")
    def masked_value(self, obj):
        if obj.is_secret and obj.value:
            masked = "****" + obj.value[-4:] if len(obj.value) > 4 else "****"
            return masked
        return obj.value or "-"


@admin.register(BssSet)
class BssSetAdmin(admin.ModelAdmin):
    """BSSセット管理"""

    list_display = [
        "set_code",
        "product_model",
        "status",
        "customer_site",
        "installed_at",
        "component_count",
        "created_at",
    ]
    list_filter = ["status", "product_model", "customer_site__customer"]
    search_fields = [
        "set_code",
        "product_model__code",
        "customer_site__name",
        "customer_site__customer__name",
    ]
    ordering = ["-created_at"]
    readonly_fields = ["created_at", "updated_at"]
    autocomplete_fields = ["product_model", "customer_site"]
    inlines = [BssSetComponentInline, BssSetConfigInline]
    date_hierarchy = "created_at"

    fieldsets = [
        ("基本情報", {
            "fields": ["set_code", "product_model", "status"],
        }),
        ("設置情報", {
            "fields": ["customer_site", "installed_at", "removed_at"],
        }),
        ("その他", {
            "fields": ["note"],
        }),
        ("システム情報", {
            "fields": ["created_at", "updated_at"],
            "classes": ["collapse"],
        }),
    ]

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            _component_count=Count("components")
        )

    @admin.display(description="構成部品数", ordering="_component_count")
    def component_count(self, obj):
        return obj._component_count


@admin.register(BssSetComponent)
class BssSetComponentAdmin(admin.ModelAdmin):
    """BSSセット構成部品管理"""

    list_display = [
        "bss_set",
        "role",
        "part_unit",
        "mounted_at",
        "unmounted_at",
        "is_mounted_display",
    ]
    list_filter = ["role", "bss_set__status"]
    search_fields = [
        "bss_set__set_code",
        "part_unit__serial_number",
        "role",
    ]
    ordering = ["bss_set", "role"]
    readonly_fields = ["created_at", "updated_at"]
    autocomplete_fields = ["bss_set", "part_unit"]

    fieldsets = [
        ("基本情報", {
            "fields": ["bss_set", "part_unit", "role"],
        }),
        ("搭載期間", {
            "fields": ["mounted_at", "unmounted_at"],
        }),
        ("その他", {
            "fields": ["note"],
        }),
        ("システム情報", {
            "fields": ["created_at", "updated_at"],
            "classes": ["collapse"],
        }),
    ]

    @admin.display(description="搭載中", boolean=True)
    def is_mounted_display(self, obj):
        return obj.is_mounted


@admin.register(BssSetConfig)
class BssSetConfigAdmin(admin.ModelAdmin):
    """BSSセット設定管理"""

    list_display = [
        "bss_set",
        "config_group",
        "key",
        "masked_value",
        "is_secret",
        "valid_from",
        "valid_to",
        "is_valid_display",
    ]
    list_filter = ["config_group", "is_secret", "bss_set"]
    search_fields = [
        "bss_set__set_code",
        "config_group",
        "key",
    ]
    ordering = ["bss_set", "config_group", "key"]
    readonly_fields = ["created_at", "updated_at"]
    autocomplete_fields = ["bss_set"]

    fieldsets = [
        ("基本情報", {
            "fields": ["bss_set", "config_group", "key"],
        }),
        ("設定値", {
            "fields": ["value", "value_json", "is_secret"],
        }),
        ("有効期間", {
            "fields": ["valid_from", "valid_to"],
        }),
        ("システム情報", {
            "fields": ["created_at", "updated_at"],
            "classes": ["collapse"],
        }),
    ]

    @admin.display(description="設定値")
    def masked_value(self, obj):
        if obj.is_secret and obj.value:
            return "****" + obj.value[-4:] if len(obj.value) > 4 else "****"
        return obj.value or "-"

    @admin.display(description="有効", boolean=True)
    def is_valid_display(self, obj):
        return obj.is_valid


# =============================================================================
# 拠点設定
# =============================================================================


@admin.register(SiteConfig)
class SiteConfigAdmin(admin.ModelAdmin):
    """拠点設定管理"""

    list_display = [
        "customer_site",
        "loyverse_account",
        "square_account",
        "updated_at",
    ]
    search_fields = [
        "customer_site__name",
        "customer_site__customer__name",
        "loyverse_account",
        "square_account",
    ]
    ordering = ["customer_site"]
    readonly_fields = ["created_at", "updated_at"]
    autocomplete_fields = ["customer_site"]

    fieldsets = [
        ("基本情報", {
            "fields": ["customer_site"],
        }),
        ("Loyverse (POS)", {
            "fields": ["loyverse_account", "loyverse_store_id", "loyverse_token"],
        }),
        ("Square (決済)", {
            "fields": ["square_account", "squ_device_id", "squ_location_id", "squ_token"],
        }),
        ("その他クレデンシャル", {
            "fields": ["paypay_secret", "baiten_cloud_key", "google_secret", "slack_bot_token"],
            "classes": ["collapse"],
        }),
        ("設定ファイル", {
            "fields": ["config_toml", "baiten_env"],
            "classes": ["collapse"],
        }),
        ("システム情報", {
            "fields": ["created_at", "updated_at"],
            "classes": ["collapse"],
        }),
    ]


# =============================================================================
# 運用履歴（追記型イベント）
# =============================================================================


class AppendOnlyAdminMixin:
    """追記型イベント用Mixin — 履歴を消さない原則のため変更・削除を禁止"""

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(MaintenanceEvent)
class MaintenanceEventAdmin(AppendOnlyAdminMixin, admin.ModelAdmin):
    """保守イベント管理（追記のみ）"""

    list_display = [
        "bss_set",
        "event_type",
        "part_unit",
        "occurred_at",
        "created_at",
    ]
    list_filter = ["event_type", "bss_set"]
    search_fields = [
        "bss_set__set_code",
        "part_unit__serial_number",
        "note",
    ]
    ordering = ["-occurred_at"]
    autocomplete_fields = ["bss_set", "part_unit"]
    date_hierarchy = "occurred_at"


@admin.register(DeployEvent)
class DeployEventAdmin(AppendOnlyAdminMixin, admin.ModelAdmin):
    """導入イベント管理（追記のみ）"""

    list_display = [
        "bss_set",
        "stage",
        "occurred_at",
        "created_at",
    ]
    list_filter = ["stage", "bss_set"]
    search_fields = ["bss_set__set_code", "note"]
    ordering = ["-occurred_at"]
    autocomplete_fields = ["bss_set"]
    date_hierarchy = "occurred_at"


# =============================================================================
# 外部連携
# =============================================================================


@admin.register(EquipmentRef)
class EquipmentRefAdmin(admin.ModelAdmin):
    """機器管理参照管理"""

    list_display = [
        "external_id",
        "name",
        "unit_count",
        "created_at",
    ]
    search_fields = ["external_id", "name", "part_units__serial_number"]
    ordering = ["external_id"]
    readonly_fields = ["created_at", "updated_at"]
    filter_horizontal = ["part_units"]

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            _unit_count=Count("part_units")
        )

    @admin.display(description="部品実物数", ordering="_unit_count")
    def unit_count(self, obj):
        return obj._unit_count


# =============================================================================
# Admin サイト設定
# =============================================================================

admin.site.site_header = "BOMOps 管理画面"
admin.site.site_title = "BOMOps"
admin.site.index_title = "AIBOD Factory / BOMOps"
