import React, { forwardRef } from "react";
import { cn } from "../../utils/cn";

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  containerClassName?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, containerClassName, ...props }, ref) => {
    return (
      <div className={containerClassName}>
        {label && (
          <label
            htmlFor={props.id}
            className="block text-sm font-medium text-muted mb-2 uppercase tracking-wider text-xs"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          className={cn(
            "unified-textarea w-full border focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all resize-none",
            error ? "border-red-300 focus:ring-red-500" : "border-line",
            props.disabled &&
              "bg-neutral-50 text-neutral-500 cursor-not-allowed",
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

export default Textarea;
