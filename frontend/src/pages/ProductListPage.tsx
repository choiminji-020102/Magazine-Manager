import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Package,
  Download,
  RefreshCw,
  Plus,
  Edit,
  Save,
  CheckCircle,
  XCircle,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import { Column } from "../components/common/Table";
import ListPage from "../components/common/ListPage";
import Breadcrumb from "../components/common/Breadcrumb";
import Modal from "../components/common/Modal";
import Input from "../components/common/Input";
import Select from "../components/common/Select";
import Tabs from "../components/common/Tabs";
import StatCard from "../components/common/StatCard";
import SearchFilterBar, {
  FilterField,
  SortOption,
  ActiveFilter,
} from "../components/common/SearchFilterBar";
import { productsApi } from "../api/productsApi";
import type {
  ProductResponse,
  ProductUpdate,
  ProductListQuery,
} from "../types/product";

type Product = ProductResponse;

const PRODUCT_KIND_LABELS = {
  YEARLY: "연간",
  MONTHLY: "월간",
  SINGLE: "단품",
};

const PRODUCT_KIND_OPTIONS = [
  { value: "YEARLY", label: "연간" },
  { value: "MONTHLY", label: "월간" },
  { value: "SINGLE", label: "단품" },
];

/** -----------------------------
 *  PhysicalInfoCard Component
 *  ----------------------------- */
function PhysicalInfoCard({
  widthMm,
  lengthMm,
  heightMm,
  weightG,
}: {
  widthMm?: number | null;
  lengthMm?: number | null;
  heightMm?: number | null;
  weightG?: number | null;
}) {
  const fmt = (v: number | null | undefined, unit: string) => {
    if (v === null || v === undefined || Number.isNaN(v)) return "-";
    return `${Math.round(v)}${unit}`;
  };

  return (
    <div className="relative p-4 bg-paper rounded-tr rounded-br rounded-bl border border-line">
      <div className="absolute -top-6 left-0">
        <span className="bg-paper px-3 py-1 text-sm font-semibold text-ink uppercase tracking-wide border-t border-l border-r border-line rounded-t">
          물리적 정보
        </span>
      </div>
      <div className="flex items-center justify-end mb-3 pt-2">
        <span className="text-xs text-ink/60">
          {fmt(widthMm, "mm")} × {fmt(lengthMm, "mm")} × {fmt(heightMm, "mm")}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
        <div className="flex flex-col items-center">
          <BookDimensionDiagram
            widthLabel={`가로 ${fmt(widthMm, "mm")}`}
            lengthLabel={`세로 ${fmt(lengthMm, "mm")}`}
            heightLabel={`두께 ${fmt(heightMm, "mm")}`}
            weightG={fmt(weightG, "g")}
          />
        </div>
      </div>
    </div>
  );
}

/** ------------------------------------
 *  BookDimensionDiagram (SVG)
 *  ------------------------------------ */
function BookDimensionDiagram({
  widthLabel,
  lengthLabel,
  heightLabel,
  weightG,
}: {
  widthLabel: string;
  lengthLabel: string;
  heightLabel: string;
  weightG: string;
}) {
  const W = 300;
  const H = 190;
  const bookX = 110;
  const bookY = 40;
  const bookW = 100;
  const bookH = 130;
  const spine = 15;
  const topDimY = bookY - 20;
  const leftDimX = bookX - 20;
  const ink = "#111827";
  const stroke = "#9CA3AF";

  return (
    <div className="flex flex-col items-center">
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="max-w-full"
        role="img"
        aria-label="책 치수 도식"
      >
        <defs>
          <marker
            id="arrow-start"
            markerWidth="5"
            markerHeight="5"
            refX="0"
            refY="2.5"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M5,0 L0,2.5 L5,5 z" fill={stroke} />
          </marker>
          <marker
            id="arrow-end"
            markerWidth="5"
            markerHeight="5"
            refX="5"
            refY="2.5"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M0,0 L5,2.5 L0,5 z" fill={stroke} />
          </marker>
        </defs>

        <line
          x1={bookX}
          y1={topDimY}
          x2={bookX + bookW}
          y2={topDimY}
          stroke={stroke}
          strokeWidth="1.5"
          markerStart="url(#arrow-start)"
          markerEnd="url(#arrow-end)"
        />
        <line
          x1={bookX}
          y1={topDimY + 4}
          x2={bookX}
          y2={bookY}
          stroke={stroke}
          strokeWidth="1"
        />
        <line
          x1={bookX + bookW}
          y1={topDimY + 4}
          x2={bookX + bookW}
          y2={bookY}
          stroke={stroke}
          strokeWidth="1"
        />
        <text
          x={bookX + bookW / 2}
          y={topDimY - 4}
          textAnchor="middle"
          fontSize="11"
          fill={ink}
          fontWeight="600"
        >
          {widthLabel}
        </text>

        <line
          x1={leftDimX}
          y1={bookY}
          x2={leftDimX}
          y2={bookY + bookH}
          stroke={stroke}
          strokeWidth="1.5"
          markerStart="url(#arrow-start)"
          markerEnd="url(#arrow-end)"
        />
        <line
          x1={leftDimX + 4}
          y1={bookY}
          x2={bookX}
          y2={bookY}
          stroke={stroke}
          strokeWidth="1"
        />
        <line
          x1={leftDimX + 4}
          y1={bookY + bookH}
          x2={bookX}
          y2={bookY + bookH}
          stroke={stroke}
          strokeWidth="1"
        />
        <text
          x={leftDimX - 8}
          y={bookY + bookH / 2}
          transform={`rotate(-90 ${leftDimX - 8} ${bookY + bookH / 2})`}
          textAnchor="middle"
          fontSize="11"
          fill={ink}
          fontWeight="600"
        >
          {lengthLabel}
        </text>

        <line
          x1={bookX + bookW}
          y1={bookY + bookH / 2}
          x2={bookX + bookW + spine}
          y2={bookY + bookH / 2 + 8}
          stroke={stroke}
          strokeWidth="1.5"
          markerStart="url(#arrow-start)"
          markerEnd="url(#arrow-end)"
        />
        <line
          x1={bookX + bookW}
          y1={bookY + bookH / 2 - 6}
          x2={bookX + bookW}
          y2={bookY + bookH / 2 + 6}
          stroke={stroke}
          strokeWidth="1"
        />
        <line
          x1={bookX + bookW + spine}
          y1={bookY + bookH / 2 + 2}
          x2={bookX + bookW + spine}
          y2={bookY + bookH / 2 + 14}
          stroke={stroke}
          strokeWidth="1"
        />
        <text
          x={bookX + bookW + spine + 10}
          y={bookY + bookH / 2 + 12}
          textAnchor="start"
          fontSize="11"
          fill={ink}
          fontWeight="600"
        >
          {heightLabel}
        </text>

        <rect
          x={bookX}
          y={bookY}
          width={bookW}
          height={bookH}
          rx="6"
          fill="#FCE7F3"
          stroke="#F9A8D4"
          strokeWidth="2"
        />

        <polygon
          points={`${bookX + bookW},${bookY} ${bookX + bookW + spine},${
            bookY + 10
          } ${bookX + bookW + spine},${bookY + bookH + 10} ${bookX + bookW},${
            bookY + bookH
          }`}
          fill="#FBCFE8"
          stroke="#F9A8D4"
          strokeWidth="2"
        />
      </svg>
      <div className="-mt-2 text-center">
        <span className="text-xs font-semibold text-ink">무게: {weightG}</span>
      </div>
    </div>
  );
}

const ProductListPage: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 탭 상태
  const [productTab, setProductTab] = useState<"active" | "inactive">("active");

  // 필터 상태
  const [searchTerm, setSearchTerm] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [totalProducts, setTotalProducts] = useState(0);

  // 선택된 상품
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(
    new Set()
  );

  // 모달 상태
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Product>>({});

  // 삭제 확인 모달 상태
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productsToDelete, setProductsToDelete] = useState<Product[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // 통계용 전체 상품 데이터
  const [allProductsForStats, setAllProductsForStats] = useState<Product[]>([]);

  // 필터/검색어/탭 변경 시 페이지를 1로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, kindFilter, sortKey, sortDirection, productTab]);

  useEffect(() => {
    fetchProducts();
  }, [currentPage, searchTerm, kindFilter, productTab]);

  // 통계용 전체 상품 데이터 가져오기
  useEffect(() => {
    const fetchAllProductsForStats = async () => {
      try {
        const allProducts: Product[] = [];
        let page = 1;
        const limit = 100; // 백엔드 최대 limit
        let hasMore = true;

        // 모든 페이지를 순회하면서 데이터 가져오기
        while (hasMore) {
          const response = await productsApi.getProducts({
            page,
            limit,
          });
          const products = response.data.data;
          allProducts.push(...products);

          // 더 이상 가져올 데이터가 없으면 종료
          if (products.length < limit || allProducts.length >= response.data.pagination.total) {
            hasMore = false;
          } else {
            page++;
          }
        }

        setAllProductsForStats(allProducts);
      } catch (err) {
        console.error("통계 데이터를 불러오는데 실패했습니다:", err);
      }
    };

    fetchAllProductsForStats();
  }, []);

  // 필터 필드 정의
  const filterFields: FilterField[] = [
    {
      key: "kind",
      label: "상품 종류",
      type: "select",
      options: PRODUCT_KIND_OPTIONS,
    },
  ];

  // 정렬 옵션 정의
  const sortOptions: SortOption[] = [
    { key: "created_at", direction: "desc", label: "등록일 최신순" },
    { key: "created_at", direction: "asc", label: "등록일 오래된순" },
    { key: "product_name", direction: "asc", label: "상품명 가나다순" },
    { key: "product_name", direction: "desc", label: "상품명 역순" },
    { key: "sale", direction: "desc", label: "판매가 높은순" },
    { key: "sale", direction: "asc", label: "판매가 낮은순" },
  ];

  // 활성 필터 태그
  const activeFilters: ActiveFilter[] = [
    ...(kindFilter
      ? [
          {
            key: "kind",
            label: "상품 종류",
            value:
              kindFilter === "YEARLY"
                ? "연간"
                : kindFilter === "MONTHLY"
                ? "월간"
                : "단품",
            onRemove: () => setKindFilter(""),
          },
        ]
      : []),
  ];

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: ProductListQuery = {
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm || null,
        kind: kindFilter || null,
        is_active: productTab === "active" ? true : false,
      };

      const response = await productsApi.getProducts(params);
      setProducts(response.data.data);
      setTotalProducts(response.data.pagination.total);

      // 통계용 전체 상품 데이터도 업데이트 (여러 페이지 순회)
      const allProducts: Product[] = [];
      let statsPage = 1;
      const statsLimit = 100; // 백엔드 최대 limit
      let hasMore = true;

      while (hasMore) {
        const statsResponse = await productsApi.getProducts({
          page: statsPage,
          limit: statsLimit,
        });
        const products = statsResponse.data.data;
        allProducts.push(...products);

        if (products.length < statsLimit || allProducts.length >= statsResponse.data.pagination.total) {
          hasMore = false;
        } else {
          statsPage++;
        }
      }

      setAllProductsForStats(allProducts);
    } catch (err: any) {
      setError(err?.message || "상품 목록을 불러오는데 실패했습니다.");
      setProducts([]);
      setTotalProducts(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: string, direction: "asc" | "desc") => {
    setSortKey(key);
    setSortDirection(direction);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(
        new Set(paginatedProducts.map((p) => String(p.product_id)))
      );
    } else {
      setSelectedProducts(new Set());
    }
  };

  const handleSelectProduct = (productId: string, checked: boolean) => {
    const newSelected = new Set(selectedProducts);
    if (checked) {
      newSelected.add(productId);
    } else {
      newSelected.delete(productId);
    }
    setSelectedProducts(newSelected);
  };

  const handleViewDetail = async (product: Product) => {
    setIsDetailModalOpen(true);
    setIsEditMode(false);

    try {
      const productResponse = await productsApi.getProduct(product.product_id);
      const productData = productResponse.data.data;

      if (productData) {
        setSelectedProduct(productData);
        setEditForm(productData);
      } else {
        setSelectedProduct(product);
        setEditForm(product);
      }
    } catch (err: any) {
      console.error("상품 정보를 불러오는데 실패했습니다:", err);
      setSelectedProduct(product);
      setEditForm(product);
    }
  };

  // 수정 시작
  const handleStartEdit = () => {
    setIsEditMode(true);
    setEditForm(selectedProduct || {});
  };

  // 수정 취소
  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditForm(selectedProduct || {});
  };

  // 상품 정보 저장
  const handleSaveProduct = async () => {
    if (!selectedProduct) return;

    if (!editForm.product_name) {
      alert("상품명은 필수입니다.");
      return;
    }

    try {
      const updateData: ProductUpdate = {
        product_name: editForm.product_name || null,
        unit_weight: editForm.unit_weight !== undefined ? editForm.unit_weight : null,
        unit_width: editForm.unit_width !== undefined ? editForm.unit_width : null,
        unit_length: editForm.unit_length !== undefined ? editForm.unit_length : null,
        unit_height: editForm.unit_height !== undefined ? editForm.unit_height : null,
        price: editForm.price !== undefined ? editForm.price : null,
        sale: editForm.sale !== undefined ? editForm.sale : null,
        purchase: editForm.purchase !== undefined ? editForm.purchase : null,
        stock_quantity: editForm.stock_quantity !== undefined ? editForm.stock_quantity : null,
        is_active: editForm.is_active !== undefined ? editForm.is_active : null,
        external_product_code_cafe24:
          editForm.external_product_code_cafe24 !== undefined
            ? editForm.external_product_code_cafe24
            : null,
        external_product_code_gpmall:
          editForm.external_product_code_gpmall !== undefined
            ? editForm.external_product_code_gpmall
            : null,
        subscribe_start_issue:
          editForm.subscribe_start_issue !== undefined
            ? editForm.subscribe_start_issue
            : null,
      };

      const response = await productsApi.updateProduct(
        selectedProduct.product_id,
        updateData
      );
      const updatedProduct = response.data.data;

      if (updatedProduct) {
        setSelectedProduct(updatedProduct);
        setEditForm(updatedProduct);
        // 목록 새로고침
        await fetchProducts();
      }
      setIsEditMode(false);
      alert("상품 정보가 수정되었습니다.");
    } catch (err: any) {
      alert(err?.message || "상품 정보 수정에 실패했습니다.");
    }
  };

  // 삭제 확인 모달 열기
  const handleDeleteClick = () => {
    if (selectedProducts.size === 0) {
      alert("삭제할 상품을 선택해주세요.");
      return;
    }
    
    const selectedProductList = paginatedProducts.filter((product) =>
      selectedProducts.has(String(product.product_id))
    );
    
    setProductsToDelete(selectedProductList);
    setIsDeleteModalOpen(true);
  };

  // 상품 삭제 실행 (영구 삭제)
  const handleConfirmDelete = async () => {
    if (productsToDelete.length === 0) return;
    
    setIsDeleting(true);
    try {
      // 모든 상품 삭제 시도
      const deletePromises = productsToDelete.map((product) =>
        productsApi.deleteProduct(product.product_id)
      );
      
      await Promise.all(deletePromises);
      
      // 성공 시 목록 새로고침
      await fetchProducts();
      
      // 선택 초기화
      setSelectedProducts(new Set());
      setIsDeleteModalOpen(false);
      setProductsToDelete([]);
      
      // 삭제된 상품이 현재 상세 모달에 표시된 상품이면 모달 닫기
      if (selectedProduct && productsToDelete.some(p => p.product_id === selectedProduct.product_id)) {
        setIsDetailModalOpen(false);
        setSelectedProduct(null);
      }
      
      alert(`${productsToDelete.length}개의 상품이 영구 삭제되었습니다.`);
    } catch (err: any) {
      alert(err?.message || "상품 삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<Product>[] = [
    {
      key: "product_code",
      label: "재고 코드",
      sortable: true,
      align: "center",
      render: (value) => (
        <span className="font-mono text-sm font-medium">{value}</span>
      ),
    },
    {
      key: "product_kind",
      label: "상품 종류",
      sortable: true,
      align: "center",
      render: (value) => (
        <div className="flex justify-center">
          <Badge
            variant={
              value === "YEARLY"
                ? "info"
                : value === "MONTHLY"
                ? "success"
                : "default"
            }
            size="sm"
          >
            {PRODUCT_KIND_LABELS[value as keyof typeof PRODUCT_KIND_LABELS]}
          </Badge>
        </div>
      ),
    },
    {
      key: "product_name",
      label: "상품명",
      sortable: true,
      align: "center",
      render: (value) => (
        <span className="font-medium whitespace-normal">{value}</span>
      ),
    },
    {
      key: "price",
      label: "정가",
      align: "center",
      sortable: true,
      render: (value) => (
        <span className="font-medium">{Number(value).toLocaleString()}원</span>
      ),
    },
    {
      key: "sale",
      label: "판매가",
      align: "center",
      sortable: true,
      render: (value) => (
        <span className="font-medium text-accent">
          {Number(value).toLocaleString()}원
        </span>
      ),
    },
    {
      key: "stock_quantity",
      label: "재고",
      align: "center",
      sortable: true,
      render: (value) => {
        const stock = Number(value);
        return (
          <span
            className={`font-medium ${
              stock === 0
                ? "text-red-600"
                : stock < 10
                ? "text-orange-600"
                : "text-ink"
            }`}
          >
            {stock.toLocaleString()}
          </span>
        );
      },
    },
    {
      key: "is_active",
      label: "판매 여부",
      align: "center",
      render: (value) => (
        <div className="flex justify-center">
          <Badge variant={value ? "subscription-active" : "default"}>
            {value ? "활성" : "비활성"}
          </Badge>
        </div>
      ),
    },
    {
      key: "created_at",
      label: "등록일",
      sortable: true,
      align: "center",
      render: (value) => (
        <span className="text-sm">
          {new Date(value).toLocaleDateString("ko-KR")}
        </span>
      ),
    },
  ];

  // 클라이언트 사이드 정렬 (백엔드에 sort 파라미터가 없으므로)
  const sortedProducts = [...products].sort((a, b) => {
    const aVal = a[sortKey as keyof Product];
    const bVal = b[sortKey as keyof Product];

    if (aVal === null || aVal === undefined) {
      return sortDirection === "asc" ? 1 : -1;
    }
    if (bVal === null || bVal === undefined) {
      return sortDirection === "asc" ? -1 : 1;
    }

    if (
      sortKey === "price" ||
      sortKey === "sale" ||
      sortKey === "purchase" ||
      sortKey === "stock_quantity" ||
      sortKey === "unit_weight" ||
      sortKey === "unit_width" ||
      sortKey === "unit_length" ||
      sortKey === "unit_height"
    ) {
      const aNum = Number(aVal) || 0;
      const bNum = Number(bVal) || 0;
      if (sortDirection === "asc") {
        return aNum - bNum;
      }
      return bNum - aNum;
    }

    if (sortKey === "created_at" || sortKey === "updated_at") {
      const aDate = new Date(aVal as string).getTime();
      const bDate = new Date(bVal as string).getTime();
      if (sortDirection === "asc") {
        return aDate - bDate;
      }
      return bDate - aDate;
    }

    const aStr = String(aVal).toLowerCase();
    const bStr = String(bVal).toLowerCase();
    if (sortDirection === "asc") {
      return aStr > bStr ? 1 : -1;
    }
    return aStr < bStr ? 1 : -1;
  });

  const totalPages = Math.ceil(totalProducts / itemsPerPage);
  const paginatedProducts = sortedProducts;

  // 통계 (전체 상품 데이터 사용)
  const stats = {
    active: allProductsForStats.filter((p) => p.is_active).length,
    yearly: allProductsForStats.filter((p) => p.product_kind === "YEARLY").length,
    monthly: allProductsForStats.filter((p) => p.product_kind === "MONTHLY").length,
    single: allProductsForStats.filter((p) => p.product_kind === "SINGLE").length,
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <Breadcrumb
          items={[
            { label: "상품 관리", path: "/product/list" },
            { label: "상품 목록" },
          ]}
        />
        {/* 헤더 */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div></div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                icon={Download}
                onClick={() => {
                  // 엑셀 다운로드 로직
                }}
              >
                엑셀 다운로드
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={RefreshCw}
                onClick={fetchProducts}
                loading={loading}
              >
                새로고침
              </Button>
              <Button
                size="sm"
                icon={Plus}
                onClick={() => navigate("/product/register")}
              >
                상품 등록
              </Button>
            </div>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-paper rounded-lg border border-line">
            <StatCard
              title="활성 상품"
              value={stats.active}
              icon={Package}
              color="subscription-active"
              valueColor="text-subscription-active-600"
            />
          </div>
          <div className="bg-paper rounded-lg border border-line">
            <StatCard
              title="정기 구독"
              value={stats.yearly}
              icon={Package}
              color="blue"
            />
          </div>
          <div className="bg-paper rounded-lg border border-line">
            <StatCard
              title="월호 단품"
              value={stats.monthly}
              icon={Package}
              color="green"
            />
          </div>
          <div className="bg-paper rounded-lg border border-line">
            <StatCard
              title="일반 상품"
              value={stats.single}
              icon={Package}
              color="purple"
            />
          </div>
        </div>

        {/* 탭 */}
        <div className="mb-6">
          <Tabs
            tabs={[
              {
                key: "active",
                label: "활성 상품",
                icon: <CheckCircle className="w-4 h-4" />,
              },
              {
                key: "inactive",
                label: "비활성 상품",
                icon: <XCircle className="w-4 h-4" />,
              },
            ]}
            activeTab={productTab}
            onChange={(key) => setProductTab(key as "active" | "inactive")}
          />
        </div>

        {/* 검색 및 필터 */}
        <SearchFilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="상품명, 재고 코드로 검색"
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
          filterFields={filterFields}
          filterValues={{
            kind: kindFilter,
          }}
          onFilterChange={(key, value) => {
            if (key === "kind") {
              setKindFilter(value);
            }
          }}
          activeFilters={activeFilters}
          sortOptions={sortOptions}
          currentSort={{ key: sortKey, direction: sortDirection }}
          onSortChange={handleSort}
          onReset={() => {
            setSearchTerm("");
            setKindFilter("");
          }}
          hasActiveFilters={
            !!(searchTerm || kindFilter)
          }
        />

        {/* 목록 */}
        <ListPage
          data={paginatedProducts}
          columns={columns}
          keyExtractor={(row) => String(row.product_id)}
          emptyMessage="상품이 없습니다"
          selectable
          selectedItems={new Set(
            Array.from(selectedProducts).map((id) => String(id))
          )}
          onSelectAll={handleSelectAll}
          onSelectItem={(id, checked) =>
            handleSelectProduct(String(id), checked)
          }
          allSelected={
            paginatedProducts.length > 0 &&
            paginatedProducts.every((p) =>
              selectedProducts.has(String(p.product_id))
            )
          }
          onSort={handleSort}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onRowClick={handleViewDetail}
          hoverable
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={totalProducts}
          itemsPerPage={itemsPerPage}
          batchActions={[
            {
              label: "엑셀 다운로드",
              icon: Download,
              onClick: () => {
                // 선택된 상품 엑셀 다운로드
              },
            },
            {
              label: "삭제",
              icon: Trash2,
              onClick: handleDeleteClick,
              variant: "danger",
            },
          ]}
          loading={loading}
          error={error}
          onRetry={fetchProducts}
        />
      </div>

      {/* 상품 상세 모달 */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setIsEditMode(false);
          setSelectedProduct(null);
          setEditForm({});
        }}
        title={`상품 상세 - ${selectedProduct?.product_name || ""}`}
        size="xl"
        footer={
          isEditMode ? (
            <>
              <Button variant="ghost" onClick={handleCancelEdit}>
                취소
              </Button>
              <Button onClick={handleSaveProduct} icon={Save}>
                저장
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => setIsDetailModalOpen(false)}
              >
                닫기
              </Button>
              <Button onClick={handleStartEdit} icon={Edit}>
                수정
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (selectedProduct) {
                    setProductsToDelete([selectedProduct]);
                    setIsDeleteModalOpen(true);
                  }
                }}
                icon={Trash2}
              >
                삭제
              </Button>
            </>
          )
        }
      >
        {selectedProduct && (
          <div className="space-y-10">
            {/* 상품 기본 정보 */}
            <div className="grid grid-cols-2 gap-4 pt-6">
              {/* 왼쪽: 상품명 + 코드 */}
              <div className="relative p-4 bg-paper rounded-tr rounded-br rounded-bl border border-line">
                <div className="absolute -top-6 left-0">
                  <span className="bg-paper px-3 py-1 text-sm font-semibold text-ink uppercase tracking-wide border-t border-l border-r border-line rounded-t">
                    상품 정보
                  </span>
                </div>
                <div className="space-y-4 pt-2">
                  {/* 상품명 */}
                  {isEditMode ? (
                    <Input
                      label="상품명"
                      value={
                        editForm.product_name || selectedProduct.product_name
                      }
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          product_name: e.target.value,
                        })
                      }
                      required
                    />
                  ) : (
                    <div>
                      <label className="text-xs text-muted uppercase tracking-wide">
                        상품명
                      </label>
                      <p className="text-base font-medium text-ink mt-1">
                        {selectedProduct.product_name}
                      </p>
                    </div>
                  )}

                  {/* 재고 코드 */}
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide">
                      재고 코드
                    </label>
                    <p className="text-base font-medium text-ink mt-1 font-mono">
                      {selectedProduct.product_code}
                    </p>
                    {isEditMode && (
                      <p className="text-xs text-muted mt-1">
                        재고 코드는 수정할 수 없습니다.
                      </p>
                    )}
                  </div>

                  {/* Cafe24 상품 코드 */}
                  {isEditMode ? (
                    <Input
                      label="Cafe24 상품 코드"
                      value={
                        editForm.external_product_code_cafe24 !== undefined
                          ? editForm.external_product_code_cafe24 || ""
                          : selectedProduct.external_product_code_cafe24 || ""
                      }
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          external_product_code_cafe24: e.target.value || null,
                        })
                      }
                    />
                  ) : (
                    <div>
                      <label className="text-xs text-muted uppercase tracking-wide">
                        Cafe24 상품 코드
                      </label>
                      <p className="text-base text-ink mt-1 font-mono">
                        {selectedProduct.external_product_code_cafe24 || "-"}
                      </p>
                    </div>
                  )}

                  {/* 갓피플몰 상품 코드 */}
                  {isEditMode ? (
                    <Input
                      label="갓피플몰 상품 코드"
                      value={
                        editForm.external_product_code_gpmall !== undefined
                          ? editForm.external_product_code_gpmall || ""
                          : selectedProduct.external_product_code_gpmall || ""
                      }
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          external_product_code_gpmall: e.target.value || null,
                        })
                      }
                    />
                  ) : (
                    <div>
                      <label className="text-xs text-muted uppercase tracking-wide">
                        갓피플몰 상품 코드
                      </label>
                      <p className="text-base text-ink mt-1 font-mono">
                        {selectedProduct.external_product_code_gpmall || "-"}
                      </p>
                    </div>
                  )}

                  {/* 발행월/정기구독 시작 월 */}
                  {isEditMode ? (
                    <Input
                      label={
                        selectedProduct.product_kind === "YEARLY"
                          ? "정기구독 시작 월 (YYYYMM)"
                          : "발행월 (YYYYMM)"
                      }
                      type="text"
                      value={
                        editForm.subscribe_start_issue !== undefined
                          ? editForm.subscribe_start_issue || ""
                          : selectedProduct.subscribe_start_issue || ""
                      }
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          subscribe_start_issue: e.target.value || null,
                        })
                      }
                      placeholder="예: 202401"
                      maxLength={6}
                    />
                  ) : (
                    <div>
                      <label className="text-xs text-muted uppercase tracking-wide">
                        {selectedProduct.product_kind === "YEARLY"
                          ? "정기구독 시작 월"
                          : "발행월"}
                      </label>
                      <p className="text-base text-ink mt-1 font-mono">
                        {selectedProduct.subscribe_start_issue || "-"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 오른쪽: 상품 설정 */}
              <div className="relative p-4 bg-paper rounded-tr rounded-br rounded-bl border border-line">
                <div className="absolute -top-6 left-0">
                  <span className="bg-paper px-3 py-1 text-sm font-semibold text-ink uppercase tracking-wide border-t border-l border-r border-line rounded-t">
                    상품 설정
                  </span>
                </div>
                <div className="space-y-4 pt-2">
                  {/* 상품 종류 */}
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide">
                      상품 종류
                    </label>
                    <div className="mt-1">
                      <Badge
                        variant={
                          selectedProduct.product_kind === "YEARLY"
                            ? "info"
                            : selectedProduct.product_kind === "MONTHLY"
                            ? "success"
                            : "default"
                        }
                        size="sm"
                      >
                        {PRODUCT_KIND_LABELS[selectedProduct.product_kind]}
                      </Badge>
                    </div>
                    {isEditMode && (
                      <p className="text-xs text-muted mt-1">
                        상품 종류는 수정할 수 없습니다.
                      </p>
                    )}
                  </div>

                  {/* 판매 상태 */}
                  {isEditMode ? (
                    <Select
                      label="판매 상태"
                      required
                      value={
                        editForm.is_active !== undefined
                          ? String(editForm.is_active)
                          : String(selectedProduct.is_active)
                      }
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          is_active: e.target.value === "true",
                        })
                      }
                      options={[
                        { value: "true", label: "활성" },
                        { value: "false", label: "비활성" },
                      ]}
                    />
                  ) : (
                    <div>
                      <label className="text-xs text-muted uppercase tracking-wide">
                        판매 상태
                      </label>
                      <div className="mt-1">
                        <Badge
                          variant={
                            selectedProduct.is_active
                              ? "subscription-active"
                              : "default"
                          }
                          size="sm"
                        >
                          {selectedProduct.is_active ? "활성" : "비활성"}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 재고 정보 (YEARLY 제외) */}
            {selectedProduct.product_kind !== "YEARLY" && (
              <div className="relative p-4 bg-paper rounded-tr rounded-br rounded-bl border border-line">
                <div className="absolute -top-6 left-0">
                  <span className="bg-paper px-3 py-1 text-sm font-semibold text-ink uppercase tracking-wide border-t border-l border-r border-line rounded-t">
                    재고 정보
                  </span>
                </div>
                <div className="pt-2">
                  {isEditMode ? (
                    <Input
                      label="재고 수량"
                      type="number"
                      value={
                        editForm.stock_quantity !== undefined
                          ? String(editForm.stock_quantity)
                          : String(selectedProduct.stock_quantity)
                      }
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          stock_quantity: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  ) : (
                    <div>
                      <label className="text-xs text-muted uppercase tracking-wide">
                        재고 수량
                      </label>
                      <p className="text-base font-medium text-ink mt-1">
                        {selectedProduct.stock_quantity.toLocaleString()}개
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 가격 정보 */}
            <div className="relative p-4 bg-paper rounded-tr rounded-br rounded-bl border border-line">
              <div className="absolute -top-6 left-0">
                <span className="bg-paper px-3 py-1 text-sm font-semibold text-ink uppercase tracking-wide border-t border-l border-r border-line rounded-t">
                  가격 정보
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-2">
                {/* 정가 */}
                <div>
                  {isEditMode ? (
                    <Input
                      label="정가 (원)"
                      type="number"
                      value={
                        editForm.price !== undefined
                          ? String(editForm.price)
                          : String(selectedProduct.price)
                      }
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          price: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  ) : (
                    <div>
                      <label className="text-xs text-muted uppercase tracking-wide">
                        정가
                      </label>
                      <p className="text-base font-medium text-ink mt-1">
                        {Number(selectedProduct.price).toLocaleString()}원
                      </p>
                    </div>
                  )}
                </div>

                {/* 판매가 */}
                <div>
                  {isEditMode ? (
                    <Input
                      label="판매가 (원)"
                      type="number"
                      value={
                        editForm.sale !== undefined
                          ? String(editForm.sale)
                          : String(selectedProduct.sale)
                      }
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          sale: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  ) : (
                    <div>
                      <label className="text-xs text-muted uppercase tracking-wide">
                        판매가
                      </label>
                      <p className="text-base font-medium text-ink mt-1">
                        {Number(selectedProduct.sale).toLocaleString()}원
                      </p>
                    </div>
                  )}
                </div>

                {/* 제작단가 (YEARLY 제외) */}
                {selectedProduct.product_kind !== "YEARLY" ? (
                  <div>
                    {isEditMode ? (
                      <Input
                        label="제작단가 (원)"
                        type="number"
                        value={
                          editForm.purchase !== undefined
                            ? String(editForm.purchase)
                            : String(selectedProduct.purchase)
                        }
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            purchase: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    ) : (
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wide">
                          제작단가
                        </label>
                        <p className="text-base font-medium text-ink mt-1">
                          {Number(selectedProduct.purchase).toLocaleString()}원
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div></div>
                )}
              </div>
            </div>

            {/* 물리적 정보 (MONTHLY, SINGLE) */}
            {(selectedProduct.product_kind === "MONTHLY" || selectedProduct.product_kind === "SINGLE") && (
              <PhysicalInfoCard
                widthMm={selectedProduct.unit_width}
                lengthMm={selectedProduct.unit_length}
                heightMm={selectedProduct.unit_height}
                weightG={selectedProduct.unit_weight}
              />
            )}

            {/* 등록 정보 */}
            <div className="relative p-4 bg-paper rounded-tr rounded-br rounded-bl border border-line">
              <div className="absolute -top-6 left-0">
                <span className="bg-paper px-3 py-1 text-sm font-semibold text-ink uppercase tracking-wide border-t border-l border-r border-line rounded-t">
                  등록 정보
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    등록일시
                  </label>
                  <p className="text-base text-ink mt-1">
                    {new Date(selectedProduct.created_at).toLocaleString(
                      "ko-KR"
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide">
                    수정일시
                  </label>
                  <p className="text-base text-ink mt-1">
                    {new Date(selectedProduct.updated_at).toLocaleString(
                      "ko-KR"
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 삭제 확인 모달 */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setProductsToDelete([]);
        }}
        title="상품 삭제 확인"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button
              variant="ghost"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setProductsToDelete([]);
              }}
              disabled={isDeleting}
            >
              취소
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              icon={Trash2}
              loading={isDeleting}
              disabled={isDeleting}
            >
              영구 삭제
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-danger-50 border border-danger-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-ink mb-2">
                정말로 {productsToDelete.length}개의 상품을 영구 삭제하시겠습니까?
              </p>
              <p className="text-xs text-muted">
                이 작업은 되돌릴 수 없습니다. 삭제된 상품 정보는 복구할 수 없으며, 복원 기능이 없습니다.
              </p>
            </div>
          </div>
          
          {productsToDelete.length > 0 && (
            <div className="max-h-48 overflow-y-auto border border-line rounded-lg">
              <div className="p-3 bg-paper border-b border-line">
                <p className="text-xs font-medium text-muted uppercase tracking-wide">
                  삭제될 상품 목록 ({productsToDelete.length}개)
                </p>
              </div>
              <div className="divide-y divide-line">
                {productsToDelete.slice(0, 10).map((product) => (
                  <div key={product.product_id} className="p-3">
                    <p className="text-sm font-medium text-ink">
                      {product.product_name}
                    </p>
                    <p className="text-xs text-muted mt-1">
                      {product.product_code}
                      {product.product_kind && ` • ${PRODUCT_KIND_LABELS[product.product_kind as keyof typeof PRODUCT_KIND_LABELS]}`}
                    </p>
                  </div>
                ))}
                {productsToDelete.length > 10 && (
                  <div className="p-3 text-center">
                    <p className="text-xs text-muted">
                      외 {productsToDelete.length - 10}개...
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ProductListPage;
