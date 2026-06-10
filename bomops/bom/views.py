"""
BOMOps API ビュー定義

Django REST FrameworkのViewSetとカスタムAPIビューを定義。
"""

from typing import Any

from django.db.models import QuerySet
from django.utils import timezone
from django_filters import rest_framework as django_filters
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

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
from .serializers import (
    BssSetCompositionSerializer,
    BssSetComponentSerializer,
    BssSetConfigSerializer,
    BssSetSerializer,
    CustomerSerializer,
    CustomerSiteSerializer,
    EffectiveConfigSerializer,
    LookupBySerialSerializer,
    PartMasterSerializer,
    PartUnitSerializer,
    ProductBOMSerializer,
    ProductModelSerializer,
)


# =============================================================================
# フィルタクラス
# =============================================================================


class PartMasterFilter(django_filters.FilterSet):
    """部品マスタ用フィルタ"""

    part_code = django_filters.CharFilter(lookup_expr="icontains")
    category = django_filters.ChoiceFilter(choices=PartMaster.Category.choices)
    is_active = django_filters.BooleanFilter()

    class Meta:
        model = PartMaster
        fields = ["part_code", "category", "is_active"]


class PartUnitFilter(django_filters.FilterSet):
    """部品実物用フィルタ"""

    part_master = django_filters.NumberFilter()
    status = django_filters.ChoiceFilter(choices=PartUnit.Status.choices)
    serial_number = django_filters.CharFilter(lookup_expr="icontains")

    class Meta:
        model = PartUnit
        fields = ["part_master", "status", "serial_number"]


class ProductBOMFilter(django_filters.FilterSet):
    """製品BOM用フィルタ"""

    product_model = django_filters.NumberFilter()
    part_master = django_filters.NumberFilter()

    class Meta:
        model = ProductBOM
        fields = ["product_model", "part_master"]


class CustomerSiteFilter(django_filters.FilterSet):
    """顧客拠点用フィルタ"""

    customer = django_filters.NumberFilter()

    class Meta:
        model = CustomerSite
        fields = ["customer"]


class BssSetFilter(django_filters.FilterSet):
    """BSSセット用フィルタ"""

    product_model = django_filters.NumberFilter()
    customer_site = django_filters.NumberFilter()
    status = django_filters.ChoiceFilter(choices=BssSet.Status.choices)
    set_code = django_filters.CharFilter(lookup_expr="icontains")

    class Meta:
        model = BssSet
        fields = ["product_model", "customer_site", "status", "set_code"]


class BssSetComponentFilter(django_filters.FilterSet):
    """BSSセット構成部品用フィルタ"""

    bss_set = django_filters.NumberFilter()
    part_unit = django_filters.NumberFilter()
    role = django_filters.CharFilter(lookup_expr="icontains")

    class Meta:
        model = BssSetComponent
        fields = ["bss_set", "part_unit", "role"]


class BssSetConfigFilter(django_filters.FilterSet):
    """BSSセット設定用フィルタ"""

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
    フィルタ: part_code, category, is_active
    検索: name, model_number
    """

    queryset = PartMaster.objects.all()
    serializer_class = PartMasterSerializer
    filterset_class = PartMasterFilter
    search_fields = ["name", "model_number"]
    ordering_fields = ["part_code", "name", "created_at"]


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

    queryset = PartUnit.objects.select_related("part_master").all()
    serializer_class = PartUnitSerializer
    filterset_class = PartUnitFilter
    search_fields = ["serial_number"]
    ordering_fields = ["serial_number", "status", "created_at"]


@extend_schema_view(
    list=extend_schema(summary="製品モデル一覧取得", tags=["製品モデル"]),
    create=extend_schema(summary="製品モデル作成", tags=["製品モデル"]),
    retrieve=extend_schema(summary="製品モデル詳細取得", tags=["製品モデル"]),
    update=extend_schema(summary="製品モデル更新", tags=["製品モデル"]),
    partial_update=extend_schema(summary="製品モデル部分更新", tags=["製品モデル"]),
    destroy=extend_schema(summary="製品モデル削除", tags=["製品モデル"]),
)
class ProductModelViewSet(viewsets.ModelViewSet):
    """
    製品モデル CRUD API

    BAITEN STAND などの製品型番・バージョンを管理。
    """

    queryset = ProductModel.objects.all()
    serializer_class = ProductModelSerializer
    search_fields = ["code", "name"]
    ordering_fields = ["code", "name", "created_at"]


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
    search_fields = ["name", "code"]
    ordering_fields = ["code", "name", "created_at"]


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
    フィルタ: customer
    """

    queryset = CustomerSite.objects.select_related("customer").all()
    serializer_class = CustomerSiteSerializer
    filterset_class = CustomerSiteFilter
    search_fields = ["name", "address"]
    ordering_fields = ["customer", "name", "created_at"]


@extend_schema_view(
    list=extend_schema(summary="BSSセット一覧取得", tags=["BSSセット"]),
    create=extend_schema(summary="BSSセット作成", tags=["BSSセット"]),
    retrieve=extend_schema(summary="BSSセット詳細取得", tags=["BSSセット"]),
    update=extend_schema(summary="BSSセット更新", tags=["BSSセット"]),
    partial_update=extend_schema(summary="BSSセット部分更新", tags=["BSSセット"]),
    destroy=extend_schema(summary="BSSセット削除", tags=["BSSセット"]),
)
class BssSetViewSet(viewsets.ModelViewSet):
    """
    BSSセット CRUD API

    BAITEN STAND 実機を管理。
    フィルタ: product_model, customer_site, status
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
        summary="セット構成ビュー取得",
        description="セットに搭載されている部品の構成情報を返す",
        responses={200: BssSetCompositionSerializer},
        tags=["BSSセット"],
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
        tags=["BSSセット"],
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
    list=extend_schema(summary="BSSセット構成部品一覧取得", tags=["BSSセット構成部品"]),
    create=extend_schema(summary="BSSセット構成部品作成", tags=["BSSセット構成部品"]),
    retrieve=extend_schema(summary="BSSセット構成部品詳細取得", tags=["BSSセット構成部品"]),
    update=extend_schema(summary="BSSセット構成部品更新", tags=["BSSセット構成部品"]),
    partial_update=extend_schema(summary="BSSセット構成部品部分更新", tags=["BSSセット構成部品"]),
    destroy=extend_schema(summary="BSSセット構成部品削除", tags=["BSSセット構成部品"]),
)
class BssSetComponentViewSet(viewsets.ModelViewSet):
    """
    BSSセット構成部品 CRUD API

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
    list=extend_schema(summary="BSSセット設定一覧取得", tags=["BSSセット設定"]),
    create=extend_schema(summary="BSSセット設定作成", tags=["BSSセット設定"]),
    retrieve=extend_schema(summary="BSSセット設定詳細取得", tags=["BSSセット設定"]),
    update=extend_schema(summary="BSSセット設定更新", tags=["BSSセット設定"]),
    partial_update=extend_schema(summary="BSSセット設定部分更新", tags=["BSSセット設定"]),
    destroy=extend_schema(summary="BSSセット設定削除", tags=["BSSセット設定"]),
)
class BssSetConfigViewSet(viewsets.ModelViewSet):
    """
    BSSセット設定 CRUD API

    セットごとの設定情報（POS/PayPay/ネットワーク等）を管理。
    フィルタ: bss_set, config_group, key, is_secret
    """

    queryset = BssSetConfig.objects.select_related("bss_set").all()
    serializer_class = BssSetConfigSerializer
    filterset_class = BssSetConfigFilter
    ordering_fields = ["bss_set", "config_group", "key", "created_at"]


# =============================================================================
# カスタムAPI（仮置きstub）
# =============================================================================


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
        "serial_number": part_unit.serial_number,
        "part_master": part_unit.part_master.name,
        "current_set": current_set,
        "current_site": current_site,
    }

    serializer = LookupBySerialSerializer(data)
    return Response(serializer.data)
