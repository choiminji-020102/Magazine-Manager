import { useState, useEffect } from "react";

/**
 * 값 변경을 지정된 delay(ms)만큼 지연시켜 반환합니다.
 * 검색 입력처럼 빠른 변화를 갖는 값을 API 요청 전에 안정화할 때 사용합니다.
 *
 * @example
 * const debouncedSearch = useDebounce(search, 300);
 * // queryKey에 debouncedSearch를 사용
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
