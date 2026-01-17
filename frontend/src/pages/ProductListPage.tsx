import React, { useState, useEffect } from "react";
import {
  Package,
  Filter,
  Download,
  RefreshCw,
  Search,
  ChevronDown,
  Plus,
  ArrowUpDown,
  RotateCcw,
  X,
  Edit,
  Save,
} from "lucide-react";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Table, { Column } from "../components/common/Table";
import Pagination from "../components/common/Pagination";
import Breadcrumb from "../components/common/Breadcrumb";
import Modal from "../components/common/Modal";
import Input from "../components/common/Input";
import Textarea from "../components/common/Textarea";
import Select from "../components/common/Select";

// DB 스키마 기반 인터페이스
interface Product {
  product_id: number;
  product_code: string;
  product_kind: "YEARLY" | "MONTHLY" | "SINGLE";
  product_name: string;
  unit_weight: number;
  unit_width: number;
  unit_length: number;
  unit_height: number;
  price: number;
  sale: number;
  purchase: number;
  stock_quantity: number;
  is_active: boolean;
  external_product_code_cafe24: string | null;
  external_product_code_gpmall: string | null;
  created_at: string;
  updated_at: string;
}

interface ProductListPageProps {
  onNavigateToRegister?: () => void;
}

// 목업 데이터
const mockProducts: Product[] = [
  // 정기구독 상품 (YEARLY)
  {
    product_id: 1,
    product_code: "YEARLY-2603-BASIC",
    product_kind: "YEARLY",
    product_name: "1년 정기구독 - 26년 3월호 시작 말씀함께[기본판]",
    unit_weight: 0,
    unit_width: 0,
    unit_length: 0,
    unit_height: 0,
    price: 144000,
    sale: 144000,
    purchase: 0,
    stock_quantity: 0,
    is_active: true,
    external_product_code_cafe24: "CAFE24-Y2603-BASIC",
    external_product_code_gpmall: null,
    created_at: "2024-01-15T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 2,
    product_code: "YEARLY-2603-LARGE",
    product_kind: "YEARLY",
    product_name: "1년 정기구독 - 26년 3월호 시작 말씀함께[큰글자판]",
    unit_weight: 0,
    unit_width: 0,
    unit_length: 0,
    unit_height: 0,
    price: 144000,
    sale: 144000,
    purchase: 0,
    stock_quantity: 0,
    is_active: true,
    external_product_code_cafe24: "CAFE24-Y2603-LARGE",
    external_product_code_gpmall: null,
    created_at: "2024-01-15T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 3,
    product_code: "YEARLY-2603-CHILD-HIGH",
    product_kind: "YEARLY",
    product_name:
      "1년 정기구독 - 26년 3월호 시작 어린이 말씀함께 [고학년 4~6학년]",
    unit_weight: 200.0,
    unit_width: 210.0,
    unit_length: 297.0,
    unit_height: 5.0,
    price: 144000,
    sale: 144000,
    purchase: 50000,
    stock_quantity: 60,
    is_active: true,
    external_product_code_cafe24: "CAFE24-Y2603-CHILD-HIGH",
    external_product_code_gpmall: null,
    created_at: "2024-01-15T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 4,
    product_code: "YEARLY-2603-CHILD-LOW",
    product_kind: "YEARLY",
    product_name:
      "1년 정기구독 - 26년 3월호 시작 어린이 말씀함께 [저학년 1~3학년]",
    unit_weight: 0,
    unit_width: 0,
    unit_length: 0,
    unit_height: 0,
    price: 144000,
    sale: 144000,
    purchase: 0,
    stock_quantity: 0,
    is_active: true,
    external_product_code_cafe24: "CAFE24-Y2603-CHILD-LOW",
    external_product_code_gpmall: null,
    created_at: "2024-01-15T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 5,
    product_code: "YEARLY-2603-YOUTH",
    product_kind: "YEARLY",
    product_name: "1년 정기구독 - 26년 3월호 시작 청소년 말씀함께",
    unit_weight: 0,
    unit_width: 0,
    unit_length: 0,
    unit_height: 0,
    price: 144000,
    sale: 144000,
    purchase: 0,
    stock_quantity: 0,
    is_active: true,
    external_product_code_cafe24: "CAFE24-Y2603-YOUTH",
    external_product_code_gpmall: null,
    created_at: "2024-01-15T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 6,
    product_code: "YEARLY-2603-KKULDDANG",
    product_kind: "YEARLY",
    product_name: "1년 정기구독 - 26년 3월호 시작 꿀땅 [미취학부]",
    unit_weight: 0,
    unit_width: 0,
    unit_length: 0,
    unit_height: 0,
    price: 144000,
    sale: 144000,
    purchase: 0,
    stock_quantity: 0,
    is_active: true,
    external_product_code_cafe24: "CAFE24-Y2603-KKULDDANG",
    external_product_code_gpmall: null,
    created_at: "2024-01-15T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  // 단품 상품 (MONTHLY) - 26년 2월호
  {
    product_id: 7,
    product_code: "SINGLE-2602-BASIC",
    product_kind: "MONTHLY",
    product_name: "단품 - 26년 2월호 말씀함께 [기본판]",
    unit_weight: 250.5,
    unit_width: 210.0,
    unit_length: 297.0,
    unit_height: 5.0,
    price: 15000,
    sale: 15000,
    purchase: 5000,
    stock_quantity: 200,
    is_active: true,
    external_product_code_cafe24: "CAFE24-S2602-BASIC",
    external_product_code_gpmall: null,
    created_at: "2024-01-20T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 8,
    product_code: "SINGLE-2602-LARGE",
    product_kind: "MONTHLY",
    product_name: "단품 - 26년 2월호 말씀함께 [큰글자판]",
    unit_weight: 250.5,
    unit_width: 210.0,
    unit_length: 297.0,
    unit_height: 5.0,
    price: 15000,
    sale: 15000,
    purchase: 5000,
    stock_quantity: 150,
    is_active: true,
    external_product_code_cafe24: "CAFE24-S2602-LARGE",
    external_product_code_gpmall: null,
    created_at: "2024-01-20T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 9,
    product_code: "SINGLE-2602-CHILD-LOW",
    product_kind: "MONTHLY",
    product_name: "단품 - 26년 2월호 어린이 말씀함께 [저학년 1~3학년]",
    unit_weight: 200.0,
    unit_width: 210.0,
    unit_length: 297.0,
    unit_height: 5.0,
    price: 15000,
    sale: 15000,
    purchase: 5000,
    stock_quantity: 120,
    is_active: true,
    external_product_code_cafe24: "CAFE24-S2602-CHILD-LOW",
    external_product_code_gpmall: null,
    created_at: "2024-01-20T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 10,
    product_code: "SINGLE-2602-CHILD-HIGH",
    product_kind: "MONTHLY",
    product_name: "단품 - 26년 2월호 어린이 말씀함께 [고학년 4~6학년]",
    unit_weight: 200.0,
    unit_width: 210.0,
    unit_length: 297.0,
    unit_height: 5.0,
    price: 15000,
    sale: 15000,
    purchase: 5000,
    stock_quantity: 110,
    is_active: true,
    external_product_code_cafe24: "CAFE24-S2602-CHILD-HIGH",
    external_product_code_gpmall: null,
    created_at: "2024-01-20T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 11,
    product_code: "SINGLE-2602-YOUTH",
    product_kind: "MONTHLY",
    product_name: "단품 - 26년 2월호 청소년 말씀함께",
    unit_weight: 220.0,
    unit_width: 210.0,
    unit_length: 297.0,
    unit_height: 5.0,
    price: 15000,
    sale: 15000,
    purchase: 5000,
    stock_quantity: 90,
    is_active: true,
    external_product_code_cafe24: "CAFE24-S2602-YOUTH",
    external_product_code_gpmall: null,
    created_at: "2024-01-20T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 12,
    product_code: "SINGLE-2602-KKULDDANG",
    product_kind: "MONTHLY",
    product_name: "단품 - 26년 2월호 꿀땅 [미취학부]",
    unit_weight: 180.0,
    unit_width: 210.0,
    unit_length: 297.0,
    unit_height: 5.0,
    price: 15000,
    sale: 15000,
    purchase: 5000,
    stock_quantity: 80,
    is_active: true,
    external_product_code_cafe24: "CAFE24-S2602-KKULDDANG",
    external_product_code_gpmall: null,
    created_at: "2024-01-20T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  // 단품 상품 (MONTHLY) - 26년 1월호
  {
    product_id: 13,
    product_code: "SINGLE-2601-BASIC",
    product_kind: "MONTHLY",
    product_name: "단품 - 26년 1월호 말씀함께 [기본판]",
    unit_weight: 250.5,
    unit_width: 210.0,
    unit_length: 297.0,
    unit_height: 5.0,
    price: 15000,
    sale: 15000,
    purchase: 5000,
    stock_quantity: 180,
    is_active: true,
    external_product_code_cafe24: "CAFE24-S2601-BASIC",
    external_product_code_gpmall: null,
    created_at: "2024-12-01T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 14,
    product_code: "SINGLE-2601-LARGE",
    product_kind: "MONTHLY",
    product_name: "단품 - 26년 1월호 말씀함께 [큰글자판]",
    unit_weight: 250.5,
    unit_width: 210.0,
    unit_length: 297.0,
    unit_height: 5.0,
    price: 15000,
    sale: 15000,
    purchase: 5000,
    stock_quantity: 130,
    is_active: true,
    external_product_code_cafe24: "CAFE24-S2601-LARGE",
    external_product_code_gpmall: null,
    created_at: "2024-12-01T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 15,
    product_code: "SINGLE-2601-YOUTH",
    product_kind: "MONTHLY",
    product_name: "단품 - 26년 1월호 청소년 말씀함께",
    unit_weight: 220.0,
    unit_width: 210.0,
    unit_length: 297.0,
    unit_height: 5.0,
    price: 15000,
    sale: 15000,
    purchase: 5000,
    stock_quantity: 85,
    is_active: true,
    external_product_code_cafe24: "CAFE24-S2601-YOUTH",
    external_product_code_gpmall: null,
    created_at: "2024-12-01T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 16,
    product_code: "SINGLE-2601-CHILD-LOW",
    product_kind: "MONTHLY",
    product_name: "단품 - 26년 1월호 어린이 말씀함께 [저학년 1~3학년]",
    unit_weight: 200.0,
    unit_width: 210.0,
    unit_length: 297.0,
    unit_height: 5.0,
    price: 15000,
    sale: 15000,
    purchase: 5000,
    stock_quantity: 100,
    is_active: true,
    external_product_code_cafe24: "CAFE24-S2601-CHILD-LOW",
    external_product_code_gpmall: null,
    created_at: "2024-12-01T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 17,
    product_code: "SINGLE-2601-CHILD-HIGH",
    product_kind: "MONTHLY",
    product_name: "단품 - 26년 1월호 어린이 말씀함께 [고학년 4~6학년]",
    unit_weight: 200.0,
    unit_width: 210.0,
    unit_length: 297.0,
    unit_height: 5.0,
    price: 15000,
    sale: 15000,
    purchase: 5000,
    stock_quantity: 95,
    is_active: true,
    external_product_code_cafe24: "CAFE24-S2601-CHILD-HIGH",
    external_product_code_gpmall: null,
    created_at: "2024-12-01T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
  {
    product_id: 18,
    product_code: "SINGLE-2601-KKULDDANG",
    product_kind: "MONTHLY",
    product_name: "단품 - 26년 1월호 꿀땅 [미취학부]",
    unit_weight: 180.0,
    unit_width: 210.0,
    unit_length: 297.0,
    unit_height: 5.0,
    price: 15000,
    sale: 15000,
    purchase: 5000,
    stock_quantity: 75,
    is_active: true,
    external_product_code_cafe24: "CAFE24-S2601-KKULDDANG",
    external_product_code_gpmall: null,
    created_at: "2024-12-01T00:00:00",
    updated_at: "2024-12-08T00:00:00",
  },
];

const PRODUCT_KIND_LABELS = {
  YEARLY: "연간",
  MONTHLY: "월간",
  SINGLE: "단품",
};

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
    // 소수점 필요하면 여기 수정
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
        {/* 도식 */}
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
 *  - 고정 도식 + 치수선/라벨 안정 정렬
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
  // SVG 고정 캔버스
  const W = 300;
  const H = 190;

  // 책 도식(고정 크기) 영역
  const bookX = 110;
  const bookY = 40;
  const bookW = 100;
  const bookH = 130;
  const spine = 15; // 오른쪽 두께 표현

  // 치수선 위치
  const topDimY = bookY - 20; // 가로 치수선
  const leftDimX = bookX - 20; // 세로 치수선

  const ink = "#111827";
  const stroke = "#9CA3AF"; // gray-400

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
        {/* 마커(화살표) 정의 - 작게 */}
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

        {/* ---- 치수선: 가로 (위) ---- */}
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
        {/* 가로 보조선 */}
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

        {/* ---- 치수선: 세로 (왼쪽) ---- */}
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
        {/* 세로 보조선 */}
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
        {/* 세로 라벨(회전) */}
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

        {/* ---- 치수선: 두께 (오른쪽) ---- */}
        {/* 두께는 책의 옆면(등) 두께를 나타냄 - 가로 방향 */}
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
        {/* 두께 보조선 */}
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

        {/* ---- 책 도식 (중앙) ---- */}
        {/* 표지 */}
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

        {/* 책 등(두께) */}
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
      {/* 무게 - 그림 아래 */}
      <div className="-mt-2 text-center">
        <span className="text-xs font-semibold text-ink">무게: {weightG}</span>
      </div>
    </div>
  );
}

const ProductListPage: React.FC<ProductListPageProps> = ({
  onNavigateToRegister,
}) => {
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [loading, setLoading] = useState(false);

  // 필터 상태
  const [searchTerm, setSearchTerm] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortButtonRef, setSortButtonRef] = useState<HTMLDivElement | null>(
    null
  );
  const [sortMenuPosition, setSortMenuPosition] = useState({ top: 0, left: 0 });

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // 선택된 상품
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(
    new Set()
  );

  // 모달 상태
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Product>>({});

  // 정렬 메뉴 외부 클릭 처리
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        !target.closest(".sort-menu-container") &&
        !target.closest(".sort-menu-dropdown")
      ) {
        setShowSortMenu(false);
      }
    };
    if (showSortMenu && sortButtonRef) {
      const rect = sortButtonRef.getBoundingClientRect();
      const cardRect = sortButtonRef
        .closest(".relative")
        ?.getBoundingClientRect();
      if (cardRect) {
        setSortMenuPosition({
          top: rect.bottom - cardRect.top + 8,
          left: rect.left - cardRect.left,
        });
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSortMenu, sortButtonRef]);

  const handleSort = (key: string, direction: "asc" | "desc") => {
    setSortKey(key);
    setSortDirection(direction);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSelected = new Set(products.map((p) => p.product_id));
      setSelectedProducts(newSelected);
    } else {
      setSelectedProducts(new Set());
    }
  };

  const handleSelectProduct = (productId: number, checked: boolean) => {
    const newSelected = new Set(selectedProducts);
    if (checked) {
      newSelected.add(productId);
    } else {
      newSelected.delete(productId);
    }
    setSelectedProducts(newSelected);
  };

  const handleViewDetail = (product: Product, _index?: number) => {
    setSelectedProduct(product);
    setEditForm(product);
    setIsEditMode(false);
    setIsDetailModalOpen(true);
  };

  // 수정 시작
  const handleStartEdit = () => {
    if (selectedProduct) {
      setEditForm({ ...selectedProduct });
      setIsEditMode(true);
    }
  };

  // 수정 취소
  const handleCancelEdit = () => {
    setIsEditMode(false);
    if (selectedProduct) {
      setEditForm(selectedProduct);
    }
  };

  // 상품 정보 저장
  const handleSaveProduct = () => {
    if (!selectedProduct) return;

    if (!editForm.product_name || !editForm.product_code) {
      alert("상품명과 재고 코드는 필수입니다.");
      return;
    }

    // 실제로는 API 호출
    const updatedProduct: Product = {
      ...selectedProduct,
      ...editForm,
      product_id: selectedProduct.product_id,
      updated_at: new Date().toISOString(),
    };

    setProducts(
      products.map((p) =>
        p.product_id === selectedProduct.product_id ? updatedProduct : p
      )
    );
    setSelectedProduct(updatedProduct);
    setEditForm(updatedProduct);
    setIsEditMode(false);
  };

  const columns: Column<Product>[] = [
    {
      key: "checkbox",
      label: "선택",
      width: "50px",
      align: "center",
      render: (_, row) => (
        <div className="flex justify-center">
          <input
            type="checkbox"
            checked={selectedProducts.has(row.product_id)}
            onChange={(e) =>
              handleSelectProduct(row.product_id, e.target.checked)
            }
            className="w-4 h-4 rounded border-line text-accent focus:ring-accent"
          />
        </div>
      ),
    },
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

  // 필터링 및 정렬
  const filteredProducts = products
    .filter((product) => {
      if (
        searchTerm &&
        !product.product_name?.includes(searchTerm) &&
        !product.product_code?.includes(searchTerm)
      )
        return false;
      if (kindFilter && product.product_kind !== kindFilter) return false;
      if (activeFilter) {
        if (activeFilter === "active" && !product.is_active) return false;
        if (activeFilter === "inactive" && product.is_active) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aVal = a[sortKey as keyof Product];
      const bVal = b[sortKey as keyof Product];

      // null/undefined 처리
      if (aVal === null || aVal === undefined) {
        return sortDirection === "asc" ? 1 : -1;
      }
      if (bVal === null || bVal === undefined) {
        return sortDirection === "asc" ? -1 : 1;
      }

      // 숫자 필드 처리
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

      // 날짜 필드 처리
      if (sortKey === "created_at" || sortKey === "updated_at") {
        const aDate = new Date(aVal as string).getTime();
        const bDate = new Date(bVal as string).getTime();
        if (sortDirection === "asc") {
          return aDate - bDate;
        }
        return bDate - aDate;
      }

      // 문자열 필드 처리
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (sortDirection === "asc") {
        return aStr > bStr ? 1 : -1;
      }
      return aStr < bStr ? 1 : -1;
    });

  // 페이지네이션
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // 통계
  const stats = {
    total: products.length,
    active: products.filter((p) => p.is_active).length,
    outOfStock: products.filter((p) => p.stock_quantity === 0).length,
    lowStock: products.filter(
      (p) => p.stock_quantity > 0 && p.stock_quantity < 10
    ).length,
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
                onClick={() => setProducts([...mockProducts])}
                loading={loading}
              >
                새로고침
              </Button>
              <Button size="sm" icon={Plus} onClick={onNavigateToRegister}>
                상품 등록
              </Button>
            </div>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="unified-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted mb-1">전체 상품</p>
                <p className="text-2xl font-bold text-ink">{stats.total}</p>
              </div>
              <Package className="w-8 h-8 text-neutral-400" />
            </div>
          </Card>
          <Card className="unified-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted mb-1">판매중</p>
                <p className="text-2xl font-bold text-subscription-active-600">
                  {stats.active}
                </p>
              </div>
              <Package className="w-8 h-8 text-subscription-active-400" />
            </div>
          </Card>
          <Card className="unified-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted mb-1">품절</p>
                <p className="text-2xl font-bold text-red-600">
                  {stats.outOfStock}
                </p>
              </div>
              <Package className="w-8 h-8 text-red-400" />
            </div>
          </Card>
          <Card className="unified-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted mb-1">재고 부족</p>
                <p className="text-2xl font-bold text-orange-600">
                  {stats.lowStock}
                </p>
              </div>
              <Package className="w-8 h-8 text-orange-400" />
            </div>
          </Card>
        </div>

        {/* 검색 및 필터 */}
        <div className="relative">
          <Card className="unified-card mb-6 overflow-hidden" padding="none">
            <div className="p-4 bg-gradient-to-r from-paper to-white">
              {/* 상단: 검색 바, 필터 버튼, 정렬 버튼 */}
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-md font-medium text-sm transition-all ${
                    showFilters
                      ? "bg-accent text-white"
                      : "bg-white text-ink border border-line hover:border-accent/30"
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  필터
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      showFilters ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div
                  className="relative sort-menu-container"
                  ref={(el) => setSortButtonRef(el)}
                >
                  <button
                    onClick={() => setShowSortMenu(!showSortMenu)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md font-medium text-sm bg-white text-ink border border-line hover:border-accent/30 transition-all"
                  >
                    <ArrowUpDown className="w-4 h-4" />
                    정렬
                  </button>
                </div>
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted" />
                  <input
                    type="text"
                    placeholder="상품명, 재고 코드로 검색"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="unified-input pl-10 w-full"
                  />
                </div>
                {(searchTerm || kindFilter || activeFilter) && (
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setKindFilter("");
                      setActiveFilter("");
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md font-medium text-sm bg-accent text-white hover:bg-accent/90 transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                    필터&정렬 초기화
                  </button>
                )}
              </div>

              {/* 선택된 필터 태그들 */}
              {(kindFilter || activeFilter) && (
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  {kindFilter && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-sm font-medium">
                      상품 종류:{" "}
                      {kindFilter === "YEARLY"
                        ? "연간"
                        : kindFilter === "MONTHLY"
                        ? "월간"
                        : "단품"}
                      <button
                        onClick={() => setKindFilter("")}
                        className="hover:text-blue-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  {activeFilter && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-sm font-medium">
                      판매 상태: {activeFilter === "active" ? "활성" : "비활성"}
                      <button
                        onClick={() => setActiveFilter("")}
                        className="hover:text-blue-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 필터 옵션 */}
              {showFilters && (
                <div className="pt-4 border-t border-line">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="unified-label">상품 종류</label>
                      <select
                        value={kindFilter}
                        onChange={(e) => setKindFilter(e.target.value)}
                        className="unified-input w-full"
                      >
                        <option value="">전체</option>
                        <option value="YEARLY">연간</option>
                        <option value="MONTHLY">월간</option>
                        <option value="SINGLE">단품</option>
                      </select>
                    </div>
                    <div>
                      <label className="unified-label">판매 상태</label>
                      <select
                        value={activeFilter}
                        onChange={(e) => setActiveFilter(e.target.value)}
                        className="unified-input w-full"
                      >
                        <option value="">전체</option>
                        <option value="active">활성</option>
                        <option value="inactive">비활성</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* 정렬 메뉴 - Card 밖으로 분리 */}
          {showSortMenu && (
            <div
              className="absolute sort-menu-dropdown bg-white border border-line rounded-md shadow-lg z-[100] min-w-[200px]"
              style={{
                top: `${sortMenuPosition.top}px`,
                left: `${sortMenuPosition.left}px`,
              }}
            >
              <button
                onClick={() => {
                  handleSort("created_at", "desc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                등록일 최신순
              </button>
              <button
                onClick={() => {
                  handleSort("created_at", "asc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                등록일 오래된순
              </button>
              <div className="border-t border-line my-1"></div>
              <button
                onClick={() => {
                  handleSort("product_name", "asc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                상품명 가나다순
              </button>
              <button
                onClick={() => {
                  handleSort("product_name", "desc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                상품명 역순
              </button>
              <div className="border-t border-line my-1"></div>
              <button
                onClick={() => {
                  handleSort("sale", "desc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                판매가 높은순
              </button>
              <button
                onClick={() => {
                  handleSort("sale", "asc");
                  setShowSortMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-paper text-sm"
              >
                판매가 낮은순
              </button>
            </div>
          )}
        </div>

        {/* 일괄 작업 */}
        <Card className="unified-card mb-6 p-4 bg-neutral-50 border-neutral-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink">
              {selectedProducts.size}개 선택됨
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={Download}
                onClick={() => {
                  // 선택된 상품 엑셀 다운로드
                }}
                disabled={selectedProducts.size === 0}
              >
                엑셀 다운로드
              </Button>
              {selectedProducts.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedProducts(new Set())}
                >
                  선택 해제
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* 테이블 */}
        <Card className="unified-card">
          <>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={
                    products.length > 0 &&
                    selectedProducts.size === products.length
                  }
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4 rounded border-line text-accent focus:ring-accent"
                />
                <span className="text-sm text-muted">
                  전체 {filteredProducts.length}건
                </span>
              </div>
              <span className="text-sm text-muted">
                {(currentPage - 1) * itemsPerPage + 1} -{" "}
                {Math.min(currentPage * itemsPerPage, filteredProducts.length)}{" "}
                / {filteredProducts.length}
              </span>
            </div>

            <Table
              columns={columns}
              data={paginatedProducts}
              keyExtractor={(row) => String(row.product_id)}
              onSort={handleSort}
              sortKey={sortKey}
              sortDirection={sortDirection}
              emptyMessage="상품이 없습니다"
              hoverable
              onRowClick={handleViewDetail}
            />

            {totalPages > 1 && (
              <div className="mt-6">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </>
        </Card>
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
                  {isEditMode ? (
                    <Input
                      label="재고 코드"
                      value={
                        editForm.product_code || selectedProduct.product_code
                      }
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          product_code: e.target.value,
                        })
                      }
                      required
                    />
                  ) : (
                    <div>
                      <label className="text-xs text-muted uppercase tracking-wide">
                        재고 코드
                      </label>
                      <p className="text-base font-medium text-ink mt-1 font-mono">
                        {selectedProduct.product_code}
                      </p>
                    </div>
                  )}

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
                  {isEditMode ? (
                    <Select
                      label="상품 종류"
                      required
                      value={
                        editForm.product_kind || selectedProduct.product_kind
                      }
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          product_kind: e.target.value as
                            | "YEARLY"
                            | "MONTHLY"
                            | "SINGLE",
                        })
                      }
                      options={[
                        { value: "YEARLY", label: "연간" },
                        { value: "MONTHLY", label: "월간" },
                        { value: "SINGLE", label: "단품" },
                      ]}
                    />
                  ) : (
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
                    </div>
                  )}

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

            {/* 물리적 정보 (MONTHLY만) */}
            {selectedProduct.product_kind === "MONTHLY" && (
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
    </div>
  );
};

export default ProductListPage;
