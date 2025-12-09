import React, { forwardRef, useState } from "react";
import { Eye, EyeOff, LucideIcon } from "lucide-react";

import { cn } from "../../utils/cn";

type IconPosition = "left" | "right";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: LucideIcon;
  iconPosition?: IconPosition;
  containerClassName?: string;
  showPasswordToggle?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      icon: Icon,
      iconPosition = "left",
      className,
      containerClassName,
      showPasswordToggle,
      type,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPasswordType = type === "password" || type === "text";

    return (
      <div className={containerClassName}>
        {label && (
          <label
            htmlFor={props.id}
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          {Icon && iconPosition === "left" && (
            <Icon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          )}
          <input
            ref={ref}
            type={
              showPasswordToggle && isPasswordType
                ? showPassword
                  ? "text"
                  : "password"
                : type
            }
            className={cn(
              "w-full border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base py-3",
              Icon && iconPosition === "left" ? "pl-11" : "",
              Icon && iconPosition === "right" ? "pr-11" : "",
              showPasswordToggle && isPasswordType ? "pr-12" : "",
              !Icon && !showPasswordToggle ? "px-4" : "",
              Icon && iconPosition === "left" && !showPasswordToggle
                ? "pr-4"
                : "",
              error ? "border-red-300 focus:ring-red-500" : "border-gray-200",
              props.disabled && "bg-gray-50 text-gray-500",
              className
            )}
            {...props}
          />
          {Icon && iconPosition === "right" && (
            <Icon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          )}
          {showPasswordToggle && isPasswordType && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors z-10"
              tabIndex={-1}
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          )}
        </div>
        {error && (
          <p className="mt-1 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
