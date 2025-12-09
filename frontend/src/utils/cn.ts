/**
 * className 유틸리티 함수 (clsx + tailwind-merge 대체)
 */
export const cn = (
  ...classes: (string | boolean | undefined | null)[]
): string => {
  return classes.filter(Boolean).join(" ");
};
