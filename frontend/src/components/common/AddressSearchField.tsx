import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddressSearchFieldProps {
  postalCode: string;
  address: string;
  onChange: (postalCode: string, address: string) => void;
  required?: boolean;
}

// 다음 우편번호 스크립트 동적 로드
function loadDaumPostcode(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).daum?.Postcode) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("다음 우편번호 스크립트 로드 실패"));
    document.head.appendChild(script);
  });
}

export function AddressSearchField({
  postalCode,
  address,
  onChange,
  required,
}: AddressSearchFieldProps) {
  const handleSearch = async () => {
    await loadDaumPostcode();
    new (window as any).daum.Postcode({
      oncomplete: (data: any) => {
        const code = data.zonecode;
        const roadAddr = data.roadAddress || data.jibunAddress;
        const building = data.buildingName ? ` (${data.buildingName})` : "";
        onChange(code, roadAddr + building);
      },
    }).open();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1 text-xs"
          onClick={handleSearch}
        >
          <Search className="h-3 w-3" />
          주소 검색
        </Button>
        {required && !postalCode && (
          <span className="text-xs text-gray-400">주소 검색을 먼저 진행해 주세요</span>
        )}
      </div>
      <div className="flex gap-2">
        <div className="w-28">
          <Label className="text-xs text-gray-600">
            우편번호{required && <span className="text-red-500 ml-0.5">*</span>}
          </Label>
          <Input
            className="mt-1 h-8 text-sm bg-gray-50 font-mono"
            placeholder="12345"
            value={postalCode}
            readOnly
          />
        </div>
        <div className="flex-1">
          <Label className="text-xs text-gray-600">
            주소{required && <span className="text-red-500 ml-0.5">*</span>}
          </Label>
          <Input
            className="mt-1 h-8 text-sm"
            placeholder="상세주소를 직접 입력하세요"
            value={address}
            onChange={(e) => onChange(postalCode, e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
