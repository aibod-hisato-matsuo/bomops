"""
BOMOps テスト

Django 標準の TestCase を使用したAPIテスト。
"""

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

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


def make_category(name: str) -> PartCategory:
    """テスト用: カテゴリ名から PartCategory を取得（なければ作成）"""
    return PartCategory.objects.get_or_create(name=name)[0]


class PartMasterModelTest(TestCase):
    """部品マスタモデルのテスト"""

    def setUp(self) -> None:
        """テストデータのセットアップ"""
        self.part_master = PartMaster.objects.create(
            part_code="CAM-USB-001",
            name="USB Camera FullHD",
            category=make_category("カメラ"),
            maker="Logicool",
            model_number="C920n",
            spec_json={"resolution": "1920x1080", "interface": "USB2.0"},
        )

    def test_part_master_creation(self) -> None:
        """部品マスタの作成テスト"""
        self.assertEqual(self.part_master.part_code, "CAM-USB-001")
        self.assertEqual(self.part_master.name, "USB Camera FullHD")
        self.assertEqual(self.part_master.category.name, "カメラ")
        self.assertTrue(self.part_master.is_active)

    def test_part_master_str(self) -> None:
        """部品マスタの文字列表現テスト"""
        expected = "CAM-USB-001: USB Camera FullHD"
        self.assertEqual(str(self.part_master), expected)


class PartMasterAPITest(APITestCase):
    """部品マスタAPIのテスト"""

    def setUp(self) -> None:
        """テストデータとクライアントのセットアップ"""
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.part_master = PartMaster.objects.create(
            part_code="PC-001",
            name="Mini PC",
            category=make_category("PC"),
            maker="Intel",
            model_number="NUC11",
        )

    def test_list_part_masters(self) -> None:
        """部品マスタ一覧取得テスト"""
        url = reverse("bom:part-master-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_create_part_master(self) -> None:
        """部品マスタ作成テスト"""
        url = reverse("bom:part-master-list")
        data = {
            "part_code": "MON-001",
            "name": "24inch Monitor",
            "category": make_category("モニター").id,
            "maker": "Dell",
            "model_number": "P2422H",
        }
        response = self.client.post(url, data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PartMaster.objects.count(), 2)
        self.assertEqual(response.data["part_code"], "MON-001")

    def test_retrieve_part_master(self) -> None:
        """部品マスタ詳細取得テスト"""
        url = reverse("bom:part-master-detail", kwargs={"pk": self.part_master.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["part_code"], "PC-001")

    def test_filter_part_masters_by_category(self) -> None:
        """部品マスタのカテゴリフィルタテスト"""
        PartMaster.objects.create(
            part_code="CAM-001",
            name="Camera",
            category=make_category("カメラ"),
        )

        url = reverse("bom:part-master-list")
        response = self.client.get(url, {"category": "PC"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["category_display"], "PC")


class BssSetCompositionAPITest(APITestCase):
    """BSSセット構成ビューAPIのテスト"""

    def setUp(self) -> None:
        """テストデータのセットアップ"""
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        # 製品モデル作成
        self.product_model = ProductModel.objects.create(
            code="BSTAND-V1.0",
            name="BAITEN STAND V1.0",
        )

        # 部品マスタ作成
        self.pc_master = PartMaster.objects.create(
            part_code="PC-123",
            name="Mini PC",
            category=make_category("PC"),
        )
        self.cam_master = PartMaster.objects.create(
            part_code="CAM-456",
            name="USB Camera",
            category=make_category("カメラ"),
        )

        # 部品実物作成
        self.pc_unit = PartUnit.objects.create(
            part_master=self.pc_master,
            serial_number="PC-0001",
            status=PartUnit.Status.ASSIGNED,
        )
        self.cam_unit = PartUnit.objects.create(
            part_master=self.cam_master,
            serial_number="CAM-0002",
            status=PartUnit.Status.ASSIGNED,
        )

        # BSSセット作成
        self.bss_set = BssSet.objects.create(
            set_code="BST-2025-0001",
            product_model=self.product_model,
            status=BssSet.Status.ASSEMBLED,
        )

        # 構成部品作成
        BssSetComponent.objects.create(
            bss_set=self.bss_set,
            part_unit=self.pc_unit,
            role="MAIN_PC",
            mounted_at=timezone.now(),
        )
        BssSetComponent.objects.create(
            bss_set=self.bss_set,
            part_unit=self.cam_unit,
            role="CAMERA1",
            mounted_at=timezone.now(),
        )

    def test_get_composition(self) -> None:
        """セット構成ビュー取得テスト"""
        url = reverse(
            "bom:bss-set-composition",
            kwargs={"pk": self.bss_set.pk},
        )
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["set_id"], self.bss_set.id)
        self.assertEqual(response.data["set_code"], "BST-2025-0001")
        self.assertEqual(response.data["product_model"], "BSTAND-V1.0")
        self.assertEqual(len(response.data["components"]), 2)

        # 構成部品の内容確認
        roles = {comp["role"] for comp in response.data["components"]}
        self.assertIn("MAIN_PC", roles)
        self.assertIn("CAMERA1", roles)


class LookupBySerialAPITest(APITestCase):
    """シリアル番号逆引きAPIのテスト"""

    def setUp(self) -> None:
        """テストデータのセットアップ"""
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        # 顧客・拠点作成
        self.customer = Customer.objects.create(
            code="CUST-001",
            name="XX工場",
        )
        self.site = CustomerSite.objects.create(
            customer=self.customer,
            name="本社食堂",
        )

        # 製品モデル作成
        self.product_model = ProductModel.objects.create(
            code="BSTAND-V1.0",
            name="BAITEN STAND V1.0",
        )

        # 部品マスタ・実物作成
        self.cam_master = PartMaster.objects.create(
            part_code="CAM-456",
            name="USB Camera FullHD",
            category=make_category("カメラ"),
        )
        self.cam_unit = PartUnit.objects.create(
            part_master=self.cam_master,
            serial_number="CAM-0002",
            status=PartUnit.Status.ASSIGNED,
        )

        # BSSセット作成（設置済み）
        self.bss_set = BssSet.objects.create(
            set_code="BST-2025-0001",
            product_model=self.product_model,
            status=BssSet.Status.INSTALLED,
            customer_site=self.site,
            installed_at=timezone.now(),
        )

        # 構成部品作成
        BssSetComponent.objects.create(
            bss_set=self.bss_set,
            part_unit=self.cam_unit,
            role="CAMERA1",
            mounted_at=timezone.now(),
        )

    def test_lookup_by_serial_found(self) -> None:
        """シリアル番号逆引き（発見）テスト"""
        url = reverse("bom:lookup-by-serial")
        response = self.client.get(url, {"serial_number": "CAM-0002"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["serial_number"], "CAM-0002")
        self.assertEqual(response.data["part_master"], "USB Camera FullHD")
        self.assertIsNotNone(response.data["current_set"])
        self.assertEqual(response.data["current_set"]["set_code"], "BST-2025-0001")
        self.assertEqual(response.data["current_set"]["status"], "INSTALLED")
        self.assertIsNotNone(response.data["current_site"])
        self.assertEqual(response.data["current_site"]["customer"], "XX工場")
        self.assertEqual(response.data["current_site"]["site"], "本社食堂")

    def test_lookup_by_serial_not_found(self) -> None:
        """シリアル番号逆引き（未発見）テスト"""
        url = reverse("bom:lookup-by-serial")
        response = self.client.get(url, {"serial_number": "NOT-EXIST"})

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_lookup_by_serial_missing_param(self) -> None:
        """シリアル番号逆引き（パラメータ欠如）テスト"""
        url = reverse("bom:lookup-by-serial")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class PartUnitHistoryAPITest(APITestCase):
    """部品使用履歴APIのテスト"""

    def setUp(self) -> None:
        """テストデータのセットアップ"""
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.part_master = PartMaster.objects.create(
            part_code="CAM-456",
            name="USB Camera",
            category=make_category("カメラ"),
        )
        self.part_unit = PartUnit.objects.create(
            part_master=self.part_master,
            serial_number="CAM-0001",
            purchase_date="2025-01-10",
            purchase_order_no="PO-001",
        )
        self.product_model = ProductModel.objects.create(
            code="BSTAND-V1.0", name="BAITEN STAND V1.0",
        )
        self.bss_set = BssSet.objects.create(
            set_code="BST-2025-0001", product_model=self.product_model,
        )

        now = timezone.now()
        # 搭載→取外し→保守イベントの履歴を作成
        BssSetComponent.objects.create(
            bss_set=self.bss_set,
            part_unit=self.part_unit,
            role="CAMERA1",
            mounted_at=now - timezone.timedelta(days=30),
            unmounted_at=now - timezone.timedelta(days=5),
        )
        MaintenanceEvent.objects.create(
            bss_set=self.bss_set,
            part_unit=self.part_unit,
            event_type=MaintenanceEvent.EventType.FAILURE,
            note="映像が映らない",
            occurred_at=now - timezone.timedelta(days=6),
        )

    def test_history_timeline(self) -> None:
        """使用履歴タイムラインの統合・並び順テスト"""
        url = reverse("bom:part-unit-history", kwargs={"pk": self.part_unit.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["part_unit"]["serial_number"], "CAM-0001")

        kinds = [e["kind"] for e in response.data["timeline"]]
        # 時系列降順: 取外し(5日前) → 故障(6日前) → 搭載(30日前) → 購入(1/10)
        self.assertEqual(kinds, ["UNMOUNTED", "MAINTENANCE", "MOUNTED", "PURCHASED"])

        mounted = response.data["timeline"][2]
        self.assertEqual(mounted["set_code"], "BST-2025-0001")
        self.assertEqual(mounted["role"], "CAMERA1")

        maintenance = response.data["timeline"][1]
        self.assertEqual(maintenance["event_type"], "FAILURE")
        self.assertEqual(maintenance["note"], "映像が映らない")

        purchased = response.data["timeline"][3]
        self.assertEqual(purchased["purchase_order_no"], "PO-001")

    def test_history_empty(self) -> None:
        """履歴のない部品のタイムラインが空であることのテスト"""
        unit = PartUnit.objects.create(
            part_master=self.part_master,
            serial_number="CAM-9999",
        )
        url = reverse("bom:part-unit-history", kwargs={"pk": unit.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["timeline"], [])


class HealthAPITest(APITestCase):
    """ヘルスチェックAPIのテスト"""

    def test_health_no_auth_required(self) -> None:
        """認証なしで200を返すことのテスト（接続状態検知用）"""
        url = reverse("bom:health")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "ok")

        response = self.client.head(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class DashboardSummaryAPITest(APITestCase):
    """ダッシュボードサマリーAPIのテスト"""

    def setUp(self) -> None:
        """テストデータのセットアップ"""
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        pm = PartMaster.objects.create(
            part_code="PC-001", name="Mini PC", category=make_category("PC"),
        )
        cam = PartMaster.objects.create(
            part_code="CAM-001", name="Camera", category=make_category("カメラ"),
        )
        PartUnit.objects.create(part_master=pm, serial_number="PC-1", status="IN_STOCK")
        PartUnit.objects.create(part_master=pm, serial_number="PC-2", status="ASSIGNED")
        PartUnit.objects.create(part_master=cam, serial_number="CAM-1", status="BROKEN")

        model = ProductModel.objects.create(code="M-1", name="Model")
        BssSet.objects.create(set_code="S-1", product_model=model, status="INSTALLED")
        BssSet.objects.create(set_code="S-2", product_model=model, status="ASSEMBLED")

        customer = Customer.objects.create(code="C-1", name="顧客A")
        CustomerSite.objects.create(
            customer=customer, name="拠点1", lifecycle_status="ACTIVE",
        )
        CustomerSite.objects.create(
            customer=customer, name="拠点2", lifecycle_status="PREPARING",
        )

    def test_summary_counts(self) -> None:
        """サマリー集計がDB実数と一致することのテスト"""
        url = reverse("bom:dashboard-summary")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data

        self.assertEqual(data["sets"]["total"], 2)
        self.assertEqual(data["sets"]["by_status"]["INSTALLED"], 1)
        self.assertEqual(data["sets"]["by_status"]["ASSEMBLED"], 1)

        self.assertEqual(data["part_units"]["total"], 3)
        self.assertEqual(data["part_units"]["by_status"]["IN_STOCK"], 1)
        self.assertEqual(data["part_units"]["by_status"]["BROKEN"], 1)
        self.assertEqual(data["part_units"]["by_category"]["PC"], 2)
        self.assertEqual(data["part_units"]["by_category"]["カメラ"], 1)

        self.assertEqual(data["sites"]["total"], 2)
        self.assertEqual(data["sites"]["by_lifecycle_status"]["ACTIVE"], 1)

        self.assertEqual(data["customers"]["total"], 1)
        self.assertEqual(data["part_masters"]["total"], 2)
        self.assertEqual(data["product_models"]["total"], 1)

    def test_stock_coverage_without_bom_is_empty(self) -> None:
        """BOM未定義のモデルは stock_coverage に含まれないことのテスト"""
        url = reverse("bom:dashboard-summary")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["stock_coverage"], [])

    def test_stock_coverage_buildable_and_bottleneck(self) -> None:
        """組立可能数が必須BOM行の min(在庫//数量) で算出されることのテスト"""
        pm_pc = PartMaster.objects.get(part_code="PC-001")
        pm_cam = PartMaster.objects.get(part_code="CAM-001")
        model = ProductModel.objects.get(code="M-1")

        # 必須BOM: PC x1, CAM x2 / オプション: MON x1（在庫0でも影響しない）
        ProductBOM.objects.create(product_model=model, part_master=pm_pc, quantity=1)
        ProductBOM.objects.create(product_model=model, part_master=pm_cam, quantity=2)
        pm_mon = PartMaster.objects.create(
            part_code="MON-001", name="Monitor", category=make_category("モニター"),
        )
        ProductBOM.objects.create(
            product_model=model, part_master=pm_mon, quantity=1, is_optional=True,
        )

        # 在庫: PC=3, CAM=3 → PC: 3//1=3, CAM: 3//2=1 → 組立可能1台・ボトルネックCAM
        for i in range(3, 6):
            PartUnit.objects.create(
                part_master=pm_pc, serial_number=f"PC-{i}", status="IN_STOCK",
            )
        for i in range(2, 5):
            PartUnit.objects.create(
                part_master=pm_cam, serial_number=f"CAM-{i}", status="IN_STOCK",
            )

        url = reverse("bom:dashboard-summary")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        coverage = response.data["stock_coverage"]
        self.assertEqual(len(coverage), 1)
        row = coverage[0]
        self.assertEqual(row["product_model_code"], "M-1")
        self.assertEqual(row["buildable"], 1)
        self.assertEqual(row["bottleneck_part_code"], "CAM-001")
        self.assertEqual(row["bottleneck_stock"], 3)
        self.assertEqual(row["bottleneck_required"], 2)


class ProductHierarchyAPITest(APITestCase):
    """製品ファミリ・階層集計APIのテスト"""

    def setUp(self) -> None:
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        from .models import ProductFamily

        # マイグレーション0004のシードで "BAITEN STAND" は既に存在する
        self.baiten, _ = ProductFamily.objects.get_or_create(name="BAITEN STAND")
        self.riscv, _ = ProductFamily.objects.get_or_create(name="RISC-V Board")
        ProductModel.objects.create(
            code="BSTAND-AI", name="AI", family=self.baiten, grade="AI",
        )
        ProductModel.objects.create(
            code="BSTAND-MINI", name="Mini", family=self.baiten, grade="Mini",
        )
        ProductModel.objects.create(
            code="RV-01-8G", name="RV Board 8GB",
            family=self.riscv, grade="Pro", variation="8GB",
        )
        # family 未設定のモデル
        ProductModel.objects.create(code="LEGACY-01", name="Legacy")

    def test_hierarchy_summary(self) -> None:
        """ファミリ×グレード×バリエーション集計のテスト"""
        url = reverse("bom:product-model-hierarchy-summary")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rows = {
            (r["family"], r["grade"], r["variation"]): r["count"]
            for r in response.data
        }
        self.assertEqual(rows[("BAITEN STAND", "AI", None)], 1)
        self.assertEqual(rows[("BAITEN STAND", "Mini", None)], 1)
        self.assertEqual(rows[("RISC-V Board", "Pro", "8GB")], 1)
        self.assertEqual(rows[(None, None, None)], 1)  # family未設定

    def test_filter_by_family_and_grade(self) -> None:
        """family / grade フィルタのテスト"""
        url = reverse("bom:product-model-list")
        response = self.client.get(url, {"family": "BAITEN STAND", "grade": "AI"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["code"], "BSTAND-AI")
        self.assertEqual(response.data["results"][0]["family_name"], "BAITEN STAND")

    def test_delete_family_in_use_returns_409(self) -> None:
        """使用中ファミリの削除が409（PROTECT）になることのテスト"""
        url = reverse("bom:product-family-detail", kwargs={"pk": self.baiten.pk})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)


class PartCategoryAPITest(APITestCase):
    """部品カテゴリAPIのテスト"""

    def setUp(self) -> None:
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_category(self) -> None:
        """新規カテゴリ作成テスト"""
        url = reverse("bom:part-category-list")
        response = self.client.post(url, {"name": "キーボード"})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(PartCategory.objects.filter(name="キーボード").exists())

    def test_duplicate_name_rejected(self) -> None:
        """カテゴリ名の重複が400になることのテスト"""
        make_category("キーボード")
        url = reverse("bom:part-category-list")
        response = self.client.post(url, {"name": "キーボード"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delete_in_use_returns_409(self) -> None:
        """使用中カテゴリの削除が409（PROTECT）になることのテスト"""
        category = make_category("カメラ")
        PartMaster.objects.create(
            part_code="CAM-001", name="Camera", category=category,
        )
        url = reverse("bom:part-category-detail", kwargs={"pk": category.pk})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(PartCategory.objects.filter(pk=category.pk).exists())

    def test_delete_unused_category(self) -> None:
        """未使用カテゴリは削除できることのテスト"""
        category = make_category("不要カテゴリ")
        url = reverse("bom:part-category-detail", kwargs={"pk": category.pk})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


class PartGroupTest(APITestCase):
    """部品グループ（part_group）フィールド・フィルタのテスト"""

    def setUp(self) -> None:
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        PartMaster.objects.create(
            part_code="MPC-M001", name="MiniPC",
            category=make_category("PC"),
            part_group=PartMaster.PartGroup.MAIN,
        )
        PartMaster.objects.create(
            part_code="LTE-M001", name="LTE Router",
            category=make_category("その他"),
            part_group=PartMaster.PartGroup.PERIPHERAL,
        )
        PartMaster.objects.create(
            part_code="BLEG-M001", name="Table Leg",
            category=make_category("その他"),
            part_group=PartMaster.PartGroup.ASSEMBLY,
        )

    def test_default_is_other(self) -> None:
        """新規作成時の既定グループが OTHER であることのテスト"""
        part = PartMaster.objects.create(
            part_code="X-001", name="X", category=make_category("その他"),
        )
        self.assertEqual(part.part_group, PartMaster.PartGroup.OTHER)

    def test_filter_by_part_group(self) -> None:
        """part_group パラメータで絞り込めることのテスト"""
        url = reverse("bom:part-master-list")
        response = self.client.get(url, {"part_group": "ASSEMBLY"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        row = response.data["results"][0]
        self.assertEqual(row["part_code"], "BLEG-M001")
        self.assertEqual(row["part_group_display"], "組立部品")

    def test_search_matches_part_code(self) -> None:
        """search が部品コードにもヒットすることのテスト（大文字小文字不問）"""
        url = reverse("bom:part-master-list")
        for term in ("lte", "LTE-M001"):
            response = self.client.get(url, {"search": term})
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            codes = {r["part_code"] for r in response.data["results"]}
            self.assertIn("LTE-M001", codes, f"search={term}")

    def test_category_summary(self) -> None:
        """グループ×カテゴリ件数集計APIのテスト"""
        # MAIN グループに PC カテゴリをもう1件追加（PC=2件にする）
        PartMaster.objects.create(
            part_code="MPC-M999", name="MiniPC C",
            category=make_category("PC"),
            part_group=PartMaster.PartGroup.MAIN,
        )
        url = reverse("bom:part-master-category-summary")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rows = {(r["part_group"], r["category"]): r["count"] for r in response.data}
        self.assertEqual(rows[("MAIN", "PC")], 2)
        self.assertEqual(rows[("PERIPHERAL", "その他")], 1)
        self.assertEqual(rows[("ASSEMBLY", "その他")], 1)


class DeriveBomCommandTest(TestCase):
    """derive_bom 管理コマンドのテスト"""

    def setUp(self) -> None:
        """モデル1種・セット4台の実構成データを作成"""
        self.model = ProductModel.objects.create(code="BSTAND-AI", name="AI")
        self.pm_pc = PartMaster.objects.create(
            part_code="MPC-M001", name="MiniPC A", category=make_category("PC"),
        )
        self.pm_pc2 = PartMaster.objects.create(
            part_code="MPC-M002", name="MiniPC B", category=make_category("PC"),
        )
        self.pm_cam = PartMaster.objects.create(
            part_code="CAM-M001",
            name="Camera",
            category=make_category("カメラ"),
            used_in_ai=True,
        )
        self.pm_enc = PartMaster.objects.create(
            part_code="ENC-M001", name="Enclosure", category=make_category("その他"),
        )

        # 4台とも MPC 搭載（3台は M001, 1台は M002）→ MPCファミリ100%・代表はM001
        # ENC は1台のみ（25%）→ 任意 / CAM は未搭載だがフラグ付き → 必須追加
        serial = 0
        for i in range(4):
            bss = BssSet.objects.create(
                set_code=f"S-{i}", product_model=self.model,
            )
            pm = self.pm_pc if i < 3 else self.pm_pc2
            serial += 1
            unit = PartUnit.objects.create(
                part_master=pm, serial_number=f"U-{serial}",
            )
            BssSetComponent.objects.create(bss_set=bss, part_unit=unit)
            if i == 0:
                serial += 1
                enc_unit = PartUnit.objects.create(
                    part_master=self.pm_enc, serial_number=f"U-{serial}",
                )
                BssSetComponent.objects.create(bss_set=bss, part_unit=enc_unit)

    def _run(self, *args: str) -> None:
        from io import StringIO

        from django.core.management import call_command

        call_command("derive_bom", *args, stdout=StringIO())

    def test_derives_required_optional_and_flagged_lines(self) -> None:
        """観測100%→必須 / 25%→任意 / フラグのみ→必須 が導出されることのテスト"""
        self._run()

        lines = {
            line.part_master.part_code: line
            for line in ProductBOM.objects.filter(product_model=self.model)
        }
        self.assertEqual(set(lines), {"MPC-M001", "ENC-M001", "CAM-M001"})
        self.assertFalse(lines["MPC-M001"].is_optional)  # 観測100%・代表品番
        self.assertTrue(lines["ENC-M001"].is_optional)  # 観測25%
        self.assertFalse(lines["CAM-M001"].is_optional)  # フラグ由来
        self.assertEqual(lines["CAM-M001"].quantity, 1)

    def test_idempotent_and_dry_run(self) -> None:
        """再実行で重複せず、dry-run では書き込まれないことのテスト"""
        self._run("--dry-run")
        self.assertEqual(ProductBOM.objects.count(), 0)

        self._run()
        first = ProductBOM.objects.count()
        self._run()
        self.assertEqual(ProductBOM.objects.count(), first)

    def test_replace_removes_stale_lines(self) -> None:
        """--replace で既存の手登録行が置き換えられることのテスト"""
        stale = PartMaster.objects.create(
            part_code="OLD-M001", name="Old", category=make_category("その他"),
        )
        ProductBOM.objects.create(
            product_model=self.model, part_master=stale, quantity=9,
        )
        self._run("--replace")
        codes = set(
            ProductBOM.objects.filter(product_model=self.model).values_list(
                "part_master__part_code", flat=True
            )
        )
        self.assertNotIn("OLD-M001", codes)
        self.assertIn("MPC-M001", codes)


class PartUnitCategoryFilterAPITest(APITestCase):
    """部品実物のカテゴリフィルタのテスト"""

    def setUp(self) -> None:
        """テストデータのセットアップ"""
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        pm_pc = PartMaster.objects.create(
            part_code="PC-001", name="Mini PC", category=make_category("PC"),
        )
        pm_cam = PartMaster.objects.create(
            part_code="CAM-001", name="Camera", category=make_category("カメラ"),
        )
        PartUnit.objects.create(part_master=pm_pc, serial_number="PC-1")
        PartUnit.objects.create(part_master=pm_cam, serial_number="CAM-1")
        PartUnit.objects.create(part_master=pm_cam, serial_number="CAM-2")

    def test_filter_by_category(self) -> None:
        """category パラメータで部品マスタのカテゴリ横断検索ができることのテスト"""
        url = reverse("bom:part-unit-list")
        response = self.client.get(url, {"category": "カメラ"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)
        serials = {r["serial_number"] for r in response.data["results"]}
        self.assertEqual(serials, {"CAM-1", "CAM-2"})


class BssSetConfigAPITest(APITestCase):
    """BSSセット設定APIのテスト"""

    def setUp(self) -> None:
        """テストデータのセットアップ"""
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        # 製品モデル・BSSセット作成
        self.product_model = ProductModel.objects.create(
            code="BSTAND-V1.0",
            name="BAITEN STAND V1.0",
        )
        self.bss_set = BssSet.objects.create(
            set_code="BST-2025-0001",
            product_model=self.product_model,
        )

        # 設定作成
        BssSetConfig.objects.create(
            bss_set=self.bss_set,
            config_group="PAYPAY",
            key="merchant_id",
            value="12345678",
            is_secret=False,
        )
        BssSetConfig.objects.create(
            bss_set=self.bss_set,
            config_group="PAYPAY",
            key="api_key",
            value="secret_api_key_12345",
            is_secret=True,
        )

    def test_get_effective_configs(self) -> None:
        """有効なコンフィグ一覧取得テスト"""
        url = reverse(
            "bom:bss-set-effective-configs",
            kwargs={"pk": self.bss_set.pk},
        )
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

        # 秘匿情報はマスクされていることを確認
        for config in response.data:
            if config["key"] == "api_key":
                self.assertEqual(config["value"], "****")
                self.assertTrue(config["is_secret"])
            elif config["key"] == "merchant_id":
                self.assertEqual(config["value"], "12345678")
                self.assertFalse(config["is_secret"])


class CustomerSiteLifecycleTest(TestCase):
    """顧客拠点ライフサイクル状態のテスト"""

    def setUp(self) -> None:
        """テストデータのセットアップ"""
        self.customer = Customer.objects.create(code="CUST-001", name="XX工場")
        self.site = CustomerSite.objects.create(
            customer=self.customer,
            name="本社食堂",
        )

    def test_default_lifecycle_status(self) -> None:
        """初期状態は準備中であることのテスト"""
        self.assertEqual(
            self.site.lifecycle_status,
            CustomerSite.LifecycleStatus.PREPARING,
        )

    def test_lifecycle_transition(self) -> None:
        """準備中→稼働中→撤退済の遷移テスト"""
        self.site.lifecycle_status = CustomerSite.LifecycleStatus.ACTIVE
        self.site.save()
        self.site.refresh_from_db()
        self.assertEqual(
            self.site.lifecycle_status, CustomerSite.LifecycleStatus.ACTIVE
        )

        self.site.lifecycle_status = CustomerSite.LifecycleStatus.WITHDRAWN
        self.site.save()
        self.site.refresh_from_db()
        self.assertEqual(
            self.site.lifecycle_status, CustomerSite.LifecycleStatus.WITHDRAWN
        )


class SiteConfigModelTest(TestCase):
    """拠点設定モデルのテスト"""

    def setUp(self) -> None:
        """テストデータのセットアップ"""
        self.customer = Customer.objects.create(code="CUST-001", name="XX工場")
        self.site = CustomerSite.objects.create(
            customer=self.customer,
            name="本社食堂",
        )
        self.config = SiteConfig.objects.create(
            customer_site=self.site,
            loyverse_account="loyverse@example.com",
            loyverse_token="loyverse_secret_token_12345",
            paypay_secret="paypay_secret_67890",
        )

    def test_one_to_one_relation(self) -> None:
        """CustomerSite と SiteConfig が1:1であることのテスト"""
        self.assertEqual(self.site.config, self.config)

        # 同一拠点への2つ目の設定作成は IntegrityError
        from django.db import IntegrityError

        with self.assertRaises(IntegrityError):
            SiteConfig.objects.create(customer_site=self.site)

    def test_secret_encrypted_at_rest(self) -> None:
        """秘匿フィールドがDB上で暗号化されていることのテスト"""
        from django.db import connection

        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT loyverse_token, loyverse_account FROM site_config WHERE id = %s",
                [self.config.id],
            )
            raw_token, raw_account = cursor.fetchone()

        # 秘匿フィールドは平文ではなくFernetトークンとして保存される
        self.assertNotEqual(raw_token, "loyverse_secret_token_12345")
        self.assertTrue(raw_token.startswith("gAAAA"))
        # 非秘匿フィールドは平文のまま
        self.assertEqual(raw_account, "loyverse@example.com")

    def test_secret_decrypted_on_read(self) -> None:
        """秘匿フィールドが読み出し時に復号されることのテスト"""
        config = SiteConfig.objects.get(pk=self.config.pk)
        self.assertEqual(config.loyverse_token, "loyverse_secret_token_12345")
        self.assertEqual(config.paypay_secret, "paypay_secret_67890")


class SiteConfigAPITest(APITestCase):
    """拠点設定APIのテスト"""

    def setUp(self) -> None:
        """テストデータとクライアントのセットアップ"""
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.customer = Customer.objects.create(code="CUST-001", name="XX工場")
        self.site = CustomerSite.objects.create(
            customer=self.customer,
            name="本社食堂",
        )

    def test_create_site_config(self) -> None:
        """拠点設定作成テスト"""
        url = reverse("bom:site-config-list")
        data = {
            "customer_site": self.site.pk,
            "loyverse_account": "loyverse@example.com",
            "loyverse_token": "loyverse_secret_token_12345",
            "squ_token": "sq_secret_99999",
        }
        response = self.client.post(url, data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(SiteConfig.objects.count(), 1)

    def test_secrets_masked_in_response(self) -> None:
        """秘匿フィールドがAPIレスポンスでマスクされることのテスト"""
        SiteConfig.objects.create(
            customer_site=self.site,
            loyverse_account="loyverse@example.com",
            loyverse_token="loyverse_secret_token_12345",
            squ_token="sq",
        )

        url = reverse("bom:site-config-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result = response.data["results"][0]
        # 秘匿フィールド: 末尾4文字以外マスク
        self.assertEqual(result["loyverse_token"], "****2345")
        # 4文字以下は全マスク
        self.assertEqual(result["squ_token"], "****")
        # 未設定の秘匿フィールドは null のまま
        self.assertIsNone(result["paypay_secret"])
        # 非秘匿フィールドは平文
        self.assertEqual(result["loyverse_account"], "loyverse@example.com")


class MaintenanceEventAPITest(APITestCase):
    """保守イベントAPI（追記型）のテスト"""

    def setUp(self) -> None:
        """テストデータとクライアントのセットアップ"""
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.product_model = ProductModel.objects.create(
            code="BSTAND-V1.0",
            name="BAITEN STAND V1.0",
        )
        self.bss_set = BssSet.objects.create(
            set_code="BST-2025-0001",
            product_model=self.product_model,
        )
        self.part_master = PartMaster.objects.create(
            part_code="CAM-456",
            name="USB Camera",
            category=make_category("カメラ"),
        )
        self.part_unit = PartUnit.objects.create(
            part_master=self.part_master,
            serial_number="CAM-0002",
        )

    def test_create_maintenance_event(self) -> None:
        """保守イベント追記テスト"""
        url = reverse("bom:maintenance-event-list")
        data = {
            "bss_set": self.bss_set.pk,
            "part_unit": self.part_unit.pk,
            "event_type": "FAILURE",
            "note": "カメラ映像が映らない",
        }
        response = self.client.post(url, data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["serial_number"], "CAM-0002")

    def test_history_is_append_only(self) -> None:
        """履歴が追記され上書きで消えないことのテスト"""
        url = reverse("bom:maintenance-event-list")
        self.client.post(url, {
            "bss_set": self.bss_set.pk,
            "part_unit": self.part_unit.pk,
            "event_type": "FAILURE",
        })
        self.client.post(url, {
            "bss_set": self.bss_set.pk,
            "part_unit": self.part_unit.pk,
            "event_type": "REPLACEMENT",
        })

        response = self.client.get(url, {"bss_set": self.bss_set.pk})
        self.assertEqual(response.data["count"], 2)

    def test_update_and_delete_not_allowed(self) -> None:
        """保守イベントの更新・削除が禁止されていることのテスト"""
        event = MaintenanceEvent.objects.create(
            bss_set=self.bss_set,
            event_type=MaintenanceEvent.EventType.INSPECTION,
        )
        url = reverse("bom:maintenance-event-detail", kwargs={"pk": event.pk})

        response = self.client.put(url, {"event_type": "FAILURE"})
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        response = self.client.patch(url, {"event_type": "FAILURE"})
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(MaintenanceEvent.objects.count(), 1)


class DeployEventAPITest(APITestCase):
    """導入イベントAPI（追記型）のテスト"""

    def setUp(self) -> None:
        """テストデータとクライアントのセットアップ"""
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.product_model = ProductModel.objects.create(
            code="BSTAND-V1.0",
            name="BAITEN STAND V1.0",
        )
        self.bss_set = BssSet.objects.create(
            set_code="BST-2025-0001",
            product_model=self.product_model,
        )

    def test_deploy_stages_recorded(self) -> None:
        """設置→開通→稼働のステージ履歴が記録されることのテスト"""
        url = reverse("bom:deploy-event-list")
        for stage in ["INSTALL", "ACTIVATION", "OPERATION"]:
            response = self.client.post(url, {
                "bss_set": self.bss_set.pk,
                "stage": stage,
            })
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        response = self.client.get(url, {"bss_set": self.bss_set.pk})
        self.assertEqual(response.data["count"], 3)

    def test_delete_not_allowed(self) -> None:
        """導入イベントの削除が禁止されていることのテスト"""
        event = DeployEvent.objects.create(
            bss_set=self.bss_set,
            stage=DeployEvent.Stage.INSTALL,
        )
        url = reverse("bom:deploy-event-detail", kwargs={"pk": event.pk})

        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(DeployEvent.objects.count(), 1)


class EquipmentRefAPITest(APITestCase):
    """機器管理参照APIのテスト"""

    def setUp(self) -> None:
        """テストデータとクライアントのセットアップ"""
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.part_master = PartMaster.objects.create(
            part_code="PC-001",
            name="Mini PC",
            category=make_category("PC"),
        )
        self.unit1 = PartUnit.objects.create(
            part_master=self.part_master,
            serial_number="PC-0001",
        )
        self.unit2 = PartUnit.objects.create(
            part_master=self.part_master,
            serial_number="PC-0002",
        )

    def test_page_size_param(self) -> None:
        """page_size クエリパラメータで件数を指定できることのテスト"""
        url = reverse("bom:part-unit-list")
        response = self.client.get(url, {"page_size": 1})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)

    def test_protected_delete_returns_409(self) -> None:
        """PROTECT参照のある部品実物の削除が409を返すことのテスト"""
        product_model = ProductModel.objects.create(code="M-1", name="Model")
        bss_set = BssSet.objects.create(set_code="S-1", product_model=product_model)
        BssSetComponent.objects.create(bss_set=bss_set, part_unit=self.unit1)

        url = reverse("bom:part-unit-detail", kwargs={"pk": self.unit1.pk})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("削除できません", response.data["detail"])
        self.assertTrue(PartUnit.objects.filter(pk=self.unit1.pk).exists())

    def test_n_to_m_assignment(self) -> None:
        """機器と部品実物のN:M対応テスト"""
        url = reverse("bom:equipment-ref-list")
        response = self.client.post(url, {
            "external_id": "EQ-183e91a9-001",
            "name": "事務所PC",
            "part_units": [self.unit1.pk, self.unit2.pk],
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            set(response.data["part_unit_serials"]),
            {"PC-0001", "PC-0002"},
        )

        # 1つの部品実物が複数の機器参照に紐づけられる（N:M）
        response = self.client.post(url, {
            "external_id": "EQ-183e91a9-002",
            "name": "予備機",
            "part_units": [self.unit1.pk],
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.unit1.equipment_refs.count(), 2)
