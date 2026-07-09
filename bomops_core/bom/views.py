"""
BOMOps API ビュー定義

Django REST FrameworkのViewSetとカスタムAPIビューを定義。
"""

from datetime import datetime, time
from typing import Any

from django.db.models import Count, Q, QuerySet
from django.utils import timezone
from django_filters import rest_framework as django_filters
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

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
from .serializers import (
    BssSetCompositionSerializer,
    BssSetComponentSerializer,
    BssSetConfigSerializer,
    BssSetLocationSummarySerializer,
    BssSetSerializer,
    CustomerSerializer,
    CustomerSiteSerializer,
    DashboardSummarySerializer,
    DeployEventSerializer,
    EffectiveConfigSerializer,
    EquipmentRefSerializer,
    LookupBySerialSerializer,
    CustomerProductSummarySerializer,
    CustomerSiteStatusSummarySerializer,
    MaintenanceEventSerializer,
    PartCategorySerializer,
    PartMasterCategorySummarySerializer,
    PartMasterProductSummarySerializer,
    PartMasterSerializer,
    PartUnitHistorySerializer,
    PartUnitSerializer,
    ProductBOMSerializer,
    ProductFamilySerializer,
    ProductModelHierarchySummarySerializer,
    ProductModelSerializer,
    SiteConfigSerializer,
)


# =============================================================================
# フィルタクラス
# =============================================================================


class PartMasterFilter(django_filters.FilterSet):
    """部品マスタ用フィルタ"""

    part_code = django_filters.CharFilter(lookup_expr="icontains")
    category = django_filters.CharFilter(field_name="category__name")
    part_group = django_filters.ChoiceFilter(choices=PartMaster.PartGroup.choices)
    is_active = django_filters.BooleanFilter()
    used_in_model = django_filters.NumberFilter(
        field_name="bom_usages__product_model", distinct=True
    )
    used_in_family = django_filters.CharFilter(
        field_name="bom_usages__product_model__family__name", distinct=True
    )
    used_in_grade = django_filters.CharFilter(
        field_name="bom_usages__product_model__grade", distinct=True
    )
    unassigned = django_filters.BooleanFilter(method="filter_unassigned")

    def filter_unassigned(self, queryset, name, value):
        """真のとき、どの製品BOMにも登録されていない（未接続）部品に絞る"""
        if value:
            return queryset.filter(bom_usages__isnull=True)
        return queryset

    class Meta:
        model = PartMaster
        fields = [
            "part_code",
            "category",
            "part_group",
            "is_active",
            "used_in_model",
            "used_in_family",
            "used_in_grade",
            "unassigned",
        ]


class PartUnitFilter(django_filters.FilterSet):
    """部品実物用フィルタ"""

    part_master = django_filters.NumberFilter()
    status = django_filters.ChoiceFilter(choices=PartUnit.Status.choices)
    serial_number = django_filters.CharFilter(lookup_expr="icontains")
    category = django_filters.CharFilter(field_name="part_master__category__name")

    class Meta:
        model = PartUnit
        fields = ["part_master", "status", "serial_number", "category"]


class ProductModelFilter(django_filters.FilterSet):
    """製品モデル用フィルタ"""

    code = django_filters.CharFilter(lookup_expr="icontains")
    family = django_filters.CharFilter(field_name="family__name")
    grade = django_filters.CharFilter()
    variation = django_filters.CharFilter()

    class Meta:
        model = ProductModel
        fields = ["code", "family", "grade", "variation"]


class ProductBOMFilter(django_filters.FilterSet):
    """製品BOM用フィルタ"""

    product_model = django_filters.NumberFilter()
    part_master = django_filters.NumberFilter()

    class Meta:
        model = ProductBOM
        fields = ["product_model", "part_master"]


class CustomerFilter(django_filters.FilterSet):
    """顧客用フィルタ"""

    product_family = django_filters.CharFilter(method="filter_product_family")

    def filter_product_family(self, queryset, name, value):
        """取扱製品フィルタ（設置実績 ∪ 手動登録）"""
        return queryset.filter(
            Q(sites__sets__product_model__family__name=value)
            | Q(product_families__name=value)
        ).distinct()

    class Meta:
        model = Customer
        fields = ["product_family"]


class CustomerSiteFilter(django_filters.FilterSet):
    """顧客拠点用フィルタ"""

    customer = django_filters.NumberFilter()
    country = django_filters.CharFilter(lookup_expr="iexact")
    product_family = django_filters.CharFilter(
        field_name="sets__product_model__family__name", distinct=True
    )
    lifecycle_status = django_filters.ChoiceFilter(
        choices=CustomerSite.LifecycleStatus.choices
    )

    class Meta:
        model = CustomerSite
        fields = ["customer", "country", "product_family", "lifecycle_status"]


class SiteConfigFilter(django_filters.FilterSet):
    """拠点設定用フィルタ"""

    customer_site = django_filters.NumberFilter()

    class Meta:
        model = SiteConfig
        fields = ["customer_site"]


class MaintenanceEventFilter(django_filters.FilterSet):
    """保守イベント用フィルタ"""

    bss_set = django_filters.NumberFilter()
    part_unit = django_filters.NumberFilter()
    event_type = django_filters.ChoiceFilter(choices=MaintenanceEvent.EventType.choices)
    occurred_after = django_filters.DateTimeFilter(
        field_name="occurred_at", lookup_expr="gte"
    )
    occurred_before = django_filters.DateTimeFilter(
        field_name="occurred_at", lookup_expr="lte"
    )

    class Meta:
        model = MaintenanceEvent
        fields = ["bss_set", "part_unit", "event_type"]


class DeployEventFilter(django_filters.FilterSet):
    """導入イベント用フィルタ"""

    bss_set = django_filters.NumberFilter()
    stage = django_filters.ChoiceFilter(choices=DeployEvent.Stage.choices)
    occurred_after = django_filters.DateTimeFilter(
        field_name="occurred_at", lookup_expr="gte"
    )
    occurred_before = django_filters.DateTimeFilter(
        field_name="occurred_at", lookup_expr="lte"
    )

    class Meta:
        model = DeployEvent
        fields = ["bss_set", "stage"]


class EquipmentRefFilter(django_filters.FilterSet):
    """機器管理参照用フィルタ"""

    external_id = django_filters.CharFilter(lookup_expr="icontains")
    part_units = django_filters.NumberFilter()

    class Meta:
        model = EquipmentRef
        fields = ["external_id", "part_units"]


class BssSetFilter(django_filters.FilterSet):
    """製品セット用フィルタ"""

    product_model = django_filters.NumberFilter()
    customer_site = django_filters.NumberFilter()
    customer = django_filters.NumberFilter(field_name="customer_site__customer")
    country = django_filters.CharFilter(
        field_name="customer_site__country", lookup_expr="iexact"
    )
    status = django_filters.ChoiceFilter(choices=BssSet.Status.choices)
    set_code = django_filters.CharFilter(lookup_expr="icontains")

    class Meta:
        model = BssSet
        fields = [
            "product_model",
            "customer_site",
            "customer",
            "country",
            "status",
            "set_code",
        ]


class BssSetComponentFilter(django_filters.FilterSet):
    """製品セット構成部品用フィルタ"""

    bss_set = django_filters.NumberFilter()
    part_unit = django_filters.NumberFilter()
    role = django_filters.CharFilter(lookup_expr="icontains")

    class Meta:
        model = BssSetComponent
        fields = ["bss_set", "part_unit", "role"]


class BssSetConfigFilter(django_filters.FilterSet):
    """製品セット設定用フィルタ"""

    bss_set = django_filters.NumberFilter()
    config_group = django_filters.CharFilter(lookup_expr="iexact")
    key = django_filters.CharFilter(lookup_expr="icontains")
    is_secret = django_filters.BooleanFilter()

    class Meta:
        model = BssSetConfig
        fields = ["bss_set", "config_group", "key", "is_secret"]


# =============================================================================
# ViewSets
# =============================================================================


@extend_schema_view(
    list=extend_schema(summary="部品カテゴリ一覧取得", tags=["部品カテゴリ"]),
    create=extend_schema(summary="部品カテゴリ作成", tags=["部品カテゴリ"]),
    retrieve=extend_schema(summary="部品カテゴリ詳細取得", tags=["部品カテゴリ"]),
    update=extend_schema(summary="部品カテゴリ更新", tags=["部品カテゴリ"]),
    partial_update=extend_schema(summary="部品カテゴリ部分更新", tags=["部品カテゴリ"]),
    destroy=extend_schema(summary="部品カテゴリ削除", tags=["部品カテゴリ"]),
)
class PartCategoryViewSet(viewsets.ModelViewSet):
    """
    部品カテゴリ CRUD API

    部品の種別マスタ。画面から新規カテゴリを追加できる。
    使用中カテゴリの削除は 409 を返す（PROTECT）。
    """

    queryset = PartCategory.objects.all()
    serializer_class = PartCategorySerializer
    search_fields = ["name"]


@extend_schema_view(
    list=extend_schema(summary="部品マスタ一覧取得", tags=["部品マスタ"]),
    create=extend_schema(summary="部品マスタ作成", tags=["部品マスタ"]),
    retrieve=extend_schema(summary="部品マスタ詳細取得", tags=["部品マスタ"]),
    update=extend_schema(summary="部品マスタ更新", tags=["部品マスタ"]),
    partial_update=extend_schema(summary="部品マスタ部分更新", tags=["部品マスタ"]),
    destroy=extend_schema(summary="部品マスタ削除", tags=["部品マスタ"]),
)
class PartMasterViewSet(viewsets.ModelViewSet):
    """
    部品マスタ CRUD API

    部品の種類（型番レベル）を管理。
    フィルタ: part_code, category, part_group, is_active
    検索: part_code, name, model_number
    """

    queryset = PartMaster.objects.prefetch_related(
        "bom_usages__product_model__family"
    ).annotate(
        unit_count=Count("units", distinct=True),
        in_stock_count=Count(
            "units",
            filter=Q(units__status=PartUnit.Status.IN_STOCK),
            distinct=True,
        ),
        broken_count=Count(
            "units",
            filter=Q(units__status=PartUnit.Status.BROKEN),
            distinct=True,
        ),
    )
    serializer_class = PartMasterSerializer
    filterset_class = PartMasterFilter
    search_fields = ["part_code", "name", "model_number"]
    ordering_fields = ["part_code", "name", "created_at"]

    @extend_schema(
        summary="グループ×カテゴリ件数集計",
        description="部品グループごとのカテゴリ内訳件数を返す（一覧画面のボタン用）",
        responses={200: PartMasterCategorySummarySerializer(many=True)},
        tags=["部品マスタ"],
    )
    @action(detail=False, methods=["get"], url_path="category-summary")
    def category_summary(self, request: Request) -> Response:
        """グループ×カテゴリの件数集計API"""
        rows = (
            PartMaster.objects.values("part_group", "category__name")
            .annotate(count=Count("id"))
            .order_by("part_group", "-count", "category__name")
        )
        data = [
            {
                "part_group": row["part_group"],
                "category": row["category__name"],
                "count": row["count"],
            }
            for row in rows
        ]
        serializer = PartMasterCategorySummarySerializer(data, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="製品ファミリ別部品数集計",
        description="ProductBOM から導出した、製品ファミリごとの部品マスタ数を返す（一覧画面のボタン用）",
        responses={200: PartMasterProductSummarySerializer(many=True)},
        tags=["部品マスタ"],
    )
    @action(detail=False, methods=["get"], url_path="product-summary")
    def product_summary(self, request: Request) -> Response:
        """製品ファミリ×部品数の集計API（ProductBOM 由来）"""
        rows = (
            ProductBOM.objects.exclude(product_model__family=None)
            .values("product_model__family__name")
            .annotate(count=Count("part_master", distinct=True))
            .order_by("-count", "product_model__family__name")
        )
        data = [
            {"family": row["product_model__family__name"], "count": row["count"]}
            for row in rows
        ]
        serializer = PartMasterProductSummarySerializer(data, many=True)
        return Response(serializer.data)


@extend_schema_view(
    list=extend_schema(summary="部品実物一覧取得", tags=["部品実物"]),
    create=extend_schema(summary="部品実物作成", tags=["部品実物"]),
    retrieve=extend_schema(summary="部品実物詳細取得", tags=["部品実物"]),
    update=extend_schema(summary="部品実物更新", tags=["部品実物"]),
    partial_update=extend_schema(summary="部品実物部分更新", tags=["部品実物"]),
    destroy=extend_schema(summary="部品実物削除", tags=["部品実物"]),
)
class PartUnitViewSet(viewsets.ModelViewSet):
    """
    部品実物 CRUD API

    シリアル番号付きの部品実物を管理。
    フィルタ: part_master, status, serial_number
    """

    queryset = PartUnit.objects.select_related("part_master").prefetch_related(
        "set_assignments__bss_set__customer_site__customer"
    )
    serializer_class = PartUnitSerializer
    filterset_class = PartUnitFilter
    search_fields = ["serial_number"]
    ordering_fields = ["serial_number", "status", "created_at"]

    @extend_schema(
        summary="部品使用履歴取得",
        description="指定部品の購入・搭載/取外し・保守の履歴を時系列タイムラインで返す",
        responses={200: PartUnitHistorySerializer},
        tags=["部品実物"],
    )
    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request: Request, pk: int | None = None) -> Response:
        """
        部品使用履歴API（CLAUDE.md「Identity = serial_no」のトレーサビリティビュー）

        購入(PURCHASED)・搭載(MOUNTED)・取外し(UNMOUNTED)・保守(MAINTENANCE)を
        1本のタイムラインに統合して時系列降順で返す。
        """
        part_unit = self.get_object()
        timeline: list[dict[str, Any]] = []

        def entry(**kwargs: Any) -> dict[str, Any]:
            base: dict[str, Any] = {
                "set_code": None,
                "role": None,
                "event_type": None,
                "event_type_display": None,
                "note": None,
                "purchase_order_no": None,
            }
            base.update(kwargs)
            return base

        if part_unit.purchase_date:
            purchased_at = timezone.make_aware(
                datetime.combine(part_unit.purchase_date, time.min)
            )
            timeline.append(entry(
                kind="PURCHASED",
                occurred_at=purchased_at,
                purchase_order_no=part_unit.purchase_order_no,
            ))

        assignments = part_unit.set_assignments.select_related("bss_set")
        for assignment in assignments:
            if assignment.mounted_at:
                timeline.append(entry(
                    kind="MOUNTED",
                    occurred_at=assignment.mounted_at,
                    set_code=assignment.bss_set.set_code,
                    role=assignment.role,
                    note=assignment.note,
                ))
            if assignment.unmounted_at:
                timeline.append(entry(
                    kind="UNMOUNTED",
                    occurred_at=assignment.unmounted_at,
                    set_code=assignment.bss_set.set_code,
                    role=assignment.role,
                ))

        events = part_unit.maintenance_events.select_related("bss_set")
        for event in events:
            timeline.append(entry(
                kind="MAINTENANCE",
                occurred_at=event.occurred_at,
                set_code=event.bss_set.set_code,
                event_type=event.event_type,
                event_type_display=event.get_event_type_display(),
                note=event.note,
            ))

        timeline.sort(key=lambda e: e["occurred_at"], reverse=True)

        data = {
            "part_unit": {
                "id": part_unit.id,
                "serial_number": part_unit.serial_number,
                "part_code": part_unit.part_master.part_code,
                "part_name": part_unit.part_master.name,
                "status": part_unit.status,
                "status_display": part_unit.get_status_display(),
            },
            "timeline": timeline,
        }
        serializer = PartUnitHistorySerializer(data)
        return Response(serializer.data)


@extend_schema_view(
    list=extend_schema(summary="製品モデル一覧取得", tags=["製品モデル"]),
    create=extend_schema(summary="製品モデル作成", tags=["製品モデル"]),
    retrieve=extend_schema(summary="製品モデル詳細取得", tags=["製品モデル"]),
    update=extend_schema(summary="製品モデル更新", tags=["製品モデル"]),
    partial_update=extend_schema(summary="製品モデル部分更新", tags=["製品モデル"]),
    destroy=extend_schema(summary="製品モデル削除", tags=["製品モデル"]),
)
class ProductFamilyViewSet(viewsets.ModelViewSet):
    """
    製品ファミリ CRUD API

    製品ライン（BAITEN STAND / RISC-V Board 等）のマスタ。
    使用中ファミリの削除は 409 を返す（PROTECT）。
    """

    queryset = ProductFamily.objects.all()
    serializer_class = ProductFamilySerializer
    search_fields = ["name"]


class ProductModelViewSet(viewsets.ModelViewSet):
    """
    製品モデル CRUD API

    BAITEN STAND などの製品型番・バージョンを管理。
    分類は ファミリ → グレード → バリエーション の3軸フィルタ。
    """

    queryset = ProductModel.objects.all()
    serializer_class = ProductModelSerializer
    filterset_class = ProductModelFilter
    search_fields = ["code", "name"]
    ordering_fields = ["code", "name", "created_at"]

    @extend_schema(
        summary="ファミリ×グレード×バリエーション件数集計",
        description="製品モデルの分類階層ごとの件数を返す（一覧画面のカスケードボタン用）",
        responses={200: ProductModelHierarchySummarySerializer(many=True)},
        tags=["製品モデル"],
    )
    @action(detail=False, methods=["get"], url_path="hierarchy-summary")
    def hierarchy_summary(self, request: Request) -> Response:
        """ファミリ×グレード×バリエーションの件数集計API"""
        rows = (
            ProductModel.objects.values("family__name", "grade", "variation")
            .annotate(count=Count("id"))
            .order_by("family__name", "-count", "grade", "variation")
        )
        data = [
            {
                "family": row["family__name"],
                "grade": row["grade"],
                "variation": row["variation"],
                "count": row["count"],
            }
            for row in rows
        ]
        serializer = ProductModelHierarchySummarySerializer(data, many=True)
        return Response(serializer.data)


@extend_schema_view(
    list=extend_schema(summary="製品BOM一覧取得", tags=["製品BOM"]),
    create=extend_schema(summary="製品BOM作成", tags=["製品BOM"]),
    retrieve=extend_schema(summary="製品BOM詳細取得", tags=["製品BOM"]),
    update=extend_schema(summary="製品BOM更新", tags=["製品BOM"]),
    partial_update=extend_schema(summary="製品BOM部分更新", tags=["製品BOM"]),
    destroy=extend_schema(summary="製品BOM削除", tags=["製品BOM"]),
)
class ProductBOMViewSet(viewsets.ModelViewSet):
    """
    製品BOM CRUD API

    製品モデルに対する部品構成表を管理。
    フィルタ: product_model, part_master
    """

    queryset = ProductBOM.objects.select_related("product_model", "part_master").all()
    serializer_class = ProductBOMSerializer
    filterset_class = ProductBOMFilter
    ordering_fields = ["product_model", "part_master", "quantity"]


@extend_schema_view(
    list=extend_schema(summary="顧客一覧取得", tags=["顧客"]),
    create=extend_schema(summary="顧客作成", tags=["顧客"]),
    retrieve=extend_schema(summary="顧客詳細取得", tags=["顧客"]),
    update=extend_schema(summary="顧客更新", tags=["顧客"]),
    partial_update=extend_schema(summary="顧客部分更新", tags=["顧客"]),
    destroy=extend_schema(summary="顧客削除", tags=["顧客"]),
)
class CustomerViewSet(viewsets.ModelViewSet):
    """
    顧客 CRUD API

    装置を設置する顧客を管理。
    検索: name, code
    """

    queryset = Customer.objects.prefetch_related("sites").all()
    serializer_class = CustomerSerializer
    filterset_class = CustomerFilter
    search_fields = ["name", "code"]
    ordering_fields = ["code", "name", "created_at"]

    @extend_schema(
        summary="製品ファミリ別顧客数集計",
        description="設置済みセットから導出した、製品ファミリごとの顧客数を返す（一覧画面のボタン用）",
        responses={200: CustomerProductSummarySerializer(many=True)},
        tags=["顧客"],
    )
    @action(detail=False, methods=["get"], url_path="product-summary")
    def product_summary(self, request: Request) -> Response:
        """製品ファミリ×顧客数の集計API（設置実績 ∪ 手動登録）"""
        data = []
        for family in ProductFamily.objects.all():
            count = (
                Customer.objects.filter(
                    Q(sites__sets__product_model__family=family)
                    | Q(product_families=family)
                )
                .distinct()
                .count()
            )
            if count > 0:
                data.append({"family": family.name, "count": count})
        data.sort(key=lambda r: (-r["count"], r["family"]))
        serializer = CustomerProductSummarySerializer(data, many=True)
        return Response(serializer.data)


@extend_schema_view(
    list=extend_schema(summary="顧客拠点一覧取得", tags=["顧客拠点"]),
    create=extend_schema(summary="顧客拠点作成", tags=["顧客拠点"]),
    retrieve=extend_schema(summary="顧客拠点詳細取得", tags=["顧客拠点"]),
    update=extend_schema(summary="顧客拠点更新", tags=["顧客拠点"]),
    partial_update=extend_schema(summary="顧客拠点部分更新", tags=["顧客拠点"]),
    destroy=extend_schema(summary="顧客拠点削除", tags=["顧客拠点"]),
)
class CustomerSiteViewSet(viewsets.ModelViewSet):
    """
    顧客拠点 CRUD API

    顧客ごとの設置拠点を管理。
    フィルタ: customer, country, product_family, lifecycle_status
    """

    queryset = (
        CustomerSite.objects.select_related("customer")
        .prefetch_related("sets__product_model__family")
        .all()
    )
    serializer_class = CustomerSiteSerializer
    filterset_class = CustomerSiteFilter
    search_fields = ["name", "address"]
    ordering_fields = ["customer", "name", "created_at"]

    @extend_schema(
        summary="製品ファミリ別拠点数集計",
        description="設置済みセットから導出した、製品ファミリごとの拠点数を返す（一覧画面のボタン用）",
        responses={200: CustomerProductSummarySerializer(many=True)},
        tags=["顧客拠点"],
    )
    @action(detail=False, methods=["get"], url_path="product-summary")
    def product_summary(self, request: Request) -> Response:
        """製品ファミリ×拠点数の集計API（設置実績からの導出）"""
        rows = (
            BssSet.objects.exclude(product_model__family=None)
            .exclude(customer_site=None)
            .values("product_model__family__name")
            .annotate(count=Count("customer_site", distinct=True))
            .order_by("-count", "product_model__family__name")
        )
        data = [
            {"family": row["product_model__family__name"], "count": row["count"]}
            for row in rows
        ]
        serializer = CustomerProductSummarySerializer(data, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="ライフサイクル状態別拠点数集計",
        description="拠点をライフサイクル状態ごとに集計する（一覧画面のボタン用）",
        responses={200: CustomerSiteStatusSummarySerializer(many=True)},
        tags=["顧客拠点"],
    )
    @action(detail=False, methods=["get"], url_path="status-summary")
    def status_summary(self, request: Request) -> Response:
        """ライフサイクル状態×拠点数の集計API"""
        rows = (
            CustomerSite.objects.values("lifecycle_status")
            .annotate(count=Count("id"))
            .order_by("lifecycle_status")
        )
        data = [
            {"status": row["lifecycle_status"], "count": row["count"]}
            for row in rows
        ]
        serializer = CustomerSiteStatusSummarySerializer(data, many=True)
        return Response(serializer.data)


@extend_schema_view(
    list=extend_schema(summary="製品セット一覧取得", tags=["製品セット"]),
    create=extend_schema(summary="製品セット作成", tags=["製品セット"]),
    retrieve=extend_schema(summary="製品セット詳細取得", tags=["製品セット"]),
    update=extend_schema(summary="製品セット更新", tags=["製品セット"]),
    partial_update=extend_schema(summary="製品セット部分更新", tags=["製品セット"]),
    destroy=extend_schema(summary="製品セット削除", tags=["製品セット"]),
)
class BssSetViewSet(viewsets.ModelViewSet):
    """
    製品セット CRUD API

    完成品の実機（1台単位）を管理。
    フィルタ: product_model, customer_site, customer, country, status
    検索: set_code
    """

    queryset = BssSet.objects.select_related(
        "product_model",
        "customer_site",
        "customer_site__customer",
    ).prefetch_related("components").all()
    serializer_class = BssSetSerializer
    filterset_class = BssSetFilter
    search_fields = ["set_code"]
    ordering_fields = ["set_code", "status", "installed_at", "created_at"]

    @extend_schema(
        summary="国×顧客×拠点件数集計",
        description="製品セットの納品先階層ごとの件数を返す（一覧画面のカスケードボタン用）",
        responses={200: BssSetLocationSummarySerializer(many=True)},
        tags=["製品セット"],
    )
    @action(detail=False, methods=["get"], url_path="location-summary")
    def location_summary(self, request: Request) -> Response:
        """国×顧客×拠点の件数集計API（在庫中セットは全てnullの行に集計）"""
        rows = (
            BssSet.objects.values(
                "customer_site__country",
                "customer_site__customer",
                "customer_site__customer__name",
                "customer_site",
                "customer_site__name",
            )
            .annotate(count=Count("id"))
            .order_by("customer_site__country", "-count")
        )
        data = [
            {
                "country": row["customer_site__country"],
                "customer": row["customer_site__customer"],
                "customer_name": row["customer_site__customer__name"],
                "site": row["customer_site"],
                "site_name": row["customer_site__name"],
                "count": row["count"],
            }
            for row in rows
        ]
        serializer = BssSetLocationSummarySerializer(data, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="セット構成ビュー取得",
        description="セットに搭載されている部品の構成情報を返す",
        responses={200: BssSetCompositionSerializer},
        tags=["製品セット"],
    )
    @action(detail=True, methods=["get"], url_path="composition")
    def composition(self, request: Request, pk: int | None = None) -> Response:
        """
        セットの「構成ビュー」を返すAPI（stub）

        セットに搭載されている部品一覧を返す。
        """
        bss_set = self.get_object()

        # 搭載中の部品を取得
        components = BssSetComponent.objects.filter(
            bss_set=bss_set,
            unmounted_at__isnull=True,
        ).select_related("part_unit", "part_unit__part_master")

        component_list = [
            {
                "role": comp.role or "",
                "part_code": comp.part_unit.part_master.part_code,
                "serial_number": comp.part_unit.serial_number,
            }
            for comp in components
        ]

        data = {
            "set_id": bss_set.id,
            "set_code": bss_set.set_code,
            "product_model": bss_set.product_model.code,
            "components": component_list,
        }

        serializer = BssSetCompositionSerializer(data)
        return Response(serializer.data)

    @extend_schema(
        summary="有効なコンフィグ一覧取得",
        description="現在有効な設定情報の一覧を返す",
        responses={200: EffectiveConfigSerializer(many=True)},
        tags=["製品セット"],
    )
    @action(detail=True, methods=["get"], url_path="effective-configs")
    def effective_configs(self, request: Request, pk: int | None = None) -> Response:
        """
        セットの「現在有効なコンフィグ一覧」を返すAPI（stub）

        将来的には valid_from <= now < valid_to のものを返す。
        現段階では単純に最新レコード一覧を返す簡易実装。
        """
        bss_set = self.get_object()
        now = timezone.now()

        # 簡易実装: 有効期間が設定されていないか、現在が有効期間内のものを返す
        configs = BssSetConfig.objects.filter(bss_set=bss_set).order_by(
            "config_group", "key", "-created_at"
        )

        # config_group + key でユニークな最新レコードのみを抽出
        seen: set[tuple[str, str]] = set()
        unique_configs: list[dict[str, Any]] = []

        for config in configs:
            key_tuple = (config.config_group, config.key)
            if key_tuple not in seen:
                # 有効期間チェック（簡易版）
                if config.valid_from and now < config.valid_from:
                    continue
                if config.valid_to and now >= config.valid_to:
                    continue

                seen.add(key_tuple)
                unique_configs.append({
                    "config_group": config.config_group,
                    "key": config.key,
                    "value": "****" if config.is_secret else config.value,
                    "value_json": config.value_json,
                    "is_secret": config.is_secret,
                    "valid_from": config.valid_from,
                    "valid_to": config.valid_to,
                })

        serializer = EffectiveConfigSerializer(unique_configs, many=True)
        return Response(serializer.data)


@extend_schema_view(
    list=extend_schema(summary="製品セット構成部品一覧取得", tags=["製品セット構成部品"]),
    create=extend_schema(summary="製品セット構成部品作成", tags=["製品セット構成部品"]),
    retrieve=extend_schema(summary="製品セット構成部品詳細取得", tags=["製品セット構成部品"]),
    update=extend_schema(summary="製品セット構成部品更新", tags=["製品セット構成部品"]),
    partial_update=extend_schema(summary="製品セット構成部品部分更新", tags=["製品セット構成部品"]),
    destroy=extend_schema(summary="製品セット構成部品削除", tags=["製品セット構成部品"]),
)
class BssSetComponentViewSet(viewsets.ModelViewSet):
    """
    製品セット構成部品 CRUD API

    セットに搭載されている部品を管理。
    フィルタ: bss_set, part_unit, role
    """

    queryset = BssSetComponent.objects.select_related(
        "bss_set",
        "part_unit",
        "part_unit__part_master",
    ).all()
    serializer_class = BssSetComponentSerializer
    filterset_class = BssSetComponentFilter
    ordering_fields = ["bss_set", "role", "mounted_at", "created_at"]


@extend_schema_view(
    list=extend_schema(summary="製品セット設定一覧取得", tags=["製品セット設定"]),
    create=extend_schema(summary="製品セット設定作成", tags=["製品セット設定"]),
    retrieve=extend_schema(summary="製品セット設定詳細取得", tags=["製品セット設定"]),
    update=extend_schema(summary="製品セット設定更新", tags=["製品セット設定"]),
    partial_update=extend_schema(summary="製品セット設定部分更新", tags=["製品セット設定"]),
    destroy=extend_schema(summary="製品セット設定削除", tags=["製品セット設定"]),
)
class BssSetConfigViewSet(viewsets.ModelViewSet):
    """
    製品セット設定 CRUD API

    セットごとの設定情報（POS/PayPay/ネットワーク等）を管理。
    フィルタ: bss_set, config_group, key, is_secret
    """

    queryset = BssSetConfig.objects.select_related("bss_set").all()
    serializer_class = BssSetConfigSerializer
    filterset_class = BssSetConfigFilter
    ordering_fields = ["bss_set", "config_group", "key", "created_at"]


@extend_schema_view(
    list=extend_schema(summary="拠点設定一覧取得", tags=["拠点設定"]),
    create=extend_schema(summary="拠点設定作成", tags=["拠点設定"]),
    retrieve=extend_schema(summary="拠点設定詳細取得", tags=["拠点設定"]),
    update=extend_schema(summary="拠点設定更新", tags=["拠点設定"]),
    partial_update=extend_schema(summary="拠点設定部分更新", tags=["拠点設定"]),
    destroy=extend_schema(summary="拠点設定削除", tags=["拠点設定"]),
)
class SiteConfigViewSet(viewsets.ModelViewSet):
    """
    拠点設定 CRUD API

    拠点固有のクレデンシャル/設定（POS・決済・通知等）を管理。
    token / secret 系はレスポンスでマスクされる。
    フィルタ: customer_site
    """

    queryset = SiteConfig.objects.select_related(
        "customer_site",
        "customer_site__customer",
    ).all()
    serializer_class = SiteConfigSerializer
    filterset_class = SiteConfigFilter
    ordering_fields = ["customer_site", "created_at"]


class AppendOnlyViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """追記型イベント用ViewSet基底クラス

    履歴を消さない原則（CLAUDE.md §4.3）に従い、
    作成・一覧・詳細のみを許可し、更新・削除は提供しない。
    """


@extend_schema_view(
    list=extend_schema(summary="保守イベント一覧取得", tags=["保守イベント"]),
    create=extend_schema(summary="保守イベント追記", tags=["保守イベント"]),
    retrieve=extend_schema(summary="保守イベント詳細取得", tags=["保守イベント"]),
)
class MaintenanceEventViewSet(AppendOnlyViewSet):
    """
    保守イベント API（追記型）

    故障・交換・点検・設定変更の履歴を追記する。更新・削除は不可。
    フィルタ: bss_set, part_unit, event_type, occurred_after, occurred_before
    """

    queryset = MaintenanceEvent.objects.select_related(
        "bss_set",
        "part_unit",
    ).all()
    serializer_class = MaintenanceEventSerializer
    filterset_class = MaintenanceEventFilter
    ordering_fields = ["occurred_at", "created_at"]


@extend_schema_view(
    list=extend_schema(summary="導入イベント一覧取得", tags=["導入イベント"]),
    create=extend_schema(summary="導入イベント追記", tags=["導入イベント"]),
    retrieve=extend_schema(summary="導入イベント詳細取得", tags=["導入イベント"]),
)
class DeployEventViewSet(AppendOnlyViewSet):
    """
    導入イベント API（追記型）

    設置・開通・稼働・回収・再組立の履歴を追記する。更新・削除は不可。
    フィルタ: bss_set, stage, occurred_after, occurred_before
    """

    queryset = DeployEvent.objects.select_related("bss_set").all()
    serializer_class = DeployEventSerializer
    filterset_class = DeployEventFilter
    ordering_fields = ["occurred_at", "created_at"]


@extend_schema_view(
    list=extend_schema(summary="機器管理参照一覧取得", tags=["機器管理参照"]),
    create=extend_schema(summary="機器管理参照作成", tags=["機器管理参照"]),
    retrieve=extend_schema(summary="機器管理参照詳細取得", tags=["機器管理参照"]),
    update=extend_schema(summary="機器管理参照更新", tags=["機器管理参照"]),
    partial_update=extend_schema(summary="機器管理参照部分更新", tags=["機器管理参照"]),
    destroy=extend_schema(summary="機器管理参照削除", tags=["機器管理参照"]),
)
class EquipmentRefViewSet(viewsets.ModelViewSet):
    """
    機器管理参照 CRUD API

    L4 機器管理DBレコードと部品実物のN:M対応を管理。
    フィルタ: external_id, part_units
    """

    queryset = EquipmentRef.objects.prefetch_related("part_units").all()
    serializer_class = EquipmentRefSerializer
    filterset_class = EquipmentRefFilter
    search_fields = ["external_id", "name"]
    ordering_fields = ["external_id", "created_at"]


# =============================================================================
# カスタムAPI（仮置きstub）
# =============================================================================


@extend_schema(
    summary="ヘルスチェック",
    description="フロントエンドの接続状態検知用の軽量エンドポイント（認証不要）",
    responses={200: None},
    tags=["ヘルスチェック"],
)
@api_view(["GET", "HEAD"])
@permission_classes([AllowAny])
def health(request: Request) -> Response:
    """接続状態検知用ヘルスチェックAPI（DBアクセスなし）"""
    return Response({"status": "ok"})


def _count_by(queryset: QuerySet, field: str) -> dict[str, int]:
    """指定フィールドの値ごとの件数を辞書で返す"""
    rows = queryset.values(field).annotate(n=Count("id")).order_by(field)
    return {row[field]: row["n"] for row in rows}


def _stock_coverage() -> list[dict[str, Any]]:
    """
    製品モデルごとの「在庫から組み立て可能な台数」を算出する。

    必須BOM行（is_optional=False）ごとに 在庫数 // 必要数量 を求め、
    その最小値が組立可能数。最小を与える部品をボトルネックとして返す。
    """
    stock_by_part = {
        row["part_master_id"]: row["n"]
        for row in PartUnit.objects.filter(status=PartUnit.Status.IN_STOCK)
        .values("part_master_id")
        .annotate(n=Count("id"))
    }

    lines_by_model: dict[int, list[ProductBOM]] = {}
    bom_lines = ProductBOM.objects.filter(is_optional=False).select_related(
        "product_model", "part_master"
    )
    for line in bom_lines:
        lines_by_model.setdefault(line.product_model_id, []).append(line)

    coverage = []
    for lines in lines_by_model.values():
        bottleneck = min(
            lines,
            key=lambda ln: stock_by_part.get(ln.part_master_id, 0) // ln.quantity,
        )
        bottleneck_stock = stock_by_part.get(bottleneck.part_master_id, 0)
        model = bottleneck.product_model
        coverage.append(
            {
                "product_model_id": model.id,
                "product_model_code": model.code,
                "product_model_name": model.name,
                "buildable": bottleneck_stock // bottleneck.quantity,
                "bottleneck_part_code": bottleneck.part_master.part_code,
                "bottleneck_part_name": bottleneck.part_master.name,
                "bottleneck_stock": bottleneck_stock,
                "bottleneck_required": bottleneck.quantity,
            }
        )
    coverage.sort(key=lambda c: c["product_model_code"])
    return coverage


@extend_schema(
    summary="ダッシュボードサマリー取得",
    description="セット・部品実物・拠点・顧客の総数と状態別集計を1レスポンスで返す",
    responses={200: DashboardSummarySerializer},
    tags=["ダッシュボード"],
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_summary(request: Request) -> Response:
    """
    ダッシュボードサマリーAPI

    件数集計のみを返す（個人情報・secretは含まない）。
    """
    data = {
        "sets": {
            "total": BssSet.objects.count(),
            "by_status": _count_by(BssSet.objects.all(), "status"),
        },
        "part_units": {
            "total": PartUnit.objects.count(),
            "by_status": _count_by(PartUnit.objects.all(), "status"),
            "by_category": _count_by(
                PartUnit.objects.all(), "part_master__category__name"
            ),
        },
        "sites": {
            "total": CustomerSite.objects.count(),
            "by_lifecycle_status": _count_by(
                CustomerSite.objects.all(), "lifecycle_status"
            ),
        },
        "customers": {
            "total": Customer.objects.count(),
        },
        "part_masters": {
            "total": PartMaster.objects.count(),
        },
        "product_models": {
            "total": ProductModel.objects.count(),
        },
        "stock_coverage": _stock_coverage(),
    }
    serializer = DashboardSummarySerializer(data)
    return Response(serializer.data)


@extend_schema(
    summary="シリアル番号からセットと設置先を逆引き",
    description="シリアル番号を指定して、その部品が搭載されているセットと設置先を検索する",
    parameters=[
        OpenApiParameter(
            name="serial_number",
            type=str,
            location=OpenApiParameter.QUERY,
            description="検索するシリアル番号",
            required=True,
        ),
    ],
    responses={200: LookupBySerialSerializer},
    tags=["逆引き検索"],
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def lookup_by_serial(request: Request) -> Response:
    """
    シリアル番号からセットと設置先を逆引きするAPI（stub）

    クエリパラメータ serial_number を指定して、
    その部品が現在搭載されているセットと設置先を返す。
    """
    serial_number = request.query_params.get("serial_number")

    if not serial_number:
        return Response(
            {"error": "serial_number パラメータが必要です"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # 部品実物を検索
    try:
        part_unit = PartUnit.objects.select_related("part_master").get(
            serial_number=serial_number
        )
    except PartUnit.DoesNotExist:
        return Response(
            {"error": f"シリアル番号 '{serial_number}' が見つかりません"},
            status=status.HTTP_404_NOT_FOUND,
        )

    # 現在搭載中のセットを検索
    current_assignment = BssSetComponent.objects.filter(
        part_unit=part_unit,
        unmounted_at__isnull=True,
    ).select_related(
        "bss_set",
        "bss_set__customer_site",
        "bss_set__customer_site__customer",
    ).first()

    current_set: dict[str, Any] | None = None
    current_site: dict[str, Any] | None = None

    if current_assignment:
        bss_set = current_assignment.bss_set
        current_set = {
            "set_code": bss_set.set_code,
            "status": bss_set.status,
        }

        if bss_set.customer_site:
            current_site = {
                "customer": bss_set.customer_site.customer.name,
                "site": bss_set.customer_site.name,
            }

    data = {
        "part_unit_id": part_unit.id,
        "serial_number": part_unit.serial_number,
        "part_master": part_unit.part_master.name,
        "current_set": current_set,
        "current_site": current_site,
    }

    serializer = LookupBySerialSerializer(data)
    return Response(serializer.data)
