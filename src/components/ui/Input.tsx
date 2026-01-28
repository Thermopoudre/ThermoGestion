'use client'

import { forwardRef, useState, useId } from 'react'
import { Eye, EyeOff, AlertCircle, CheckCircle2, Info } from 'lucide-react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  success?: string
  hint?: string
  icon?: React.ReactNode
  rightIcon?: React.ReactNode
  isLoading?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ 
    label, 
    error, 
    success,
    hint,
    icon, 
    rightIcon,
    isLoading,
    type = 'text',
    className = '',
    id,
    ...props 
  }, ref) => {
    const [showPassword, setShowPassword] = useState(false)
    const generatedId = useId()
    const inputId = id || generatedId

    const isPassword = type === 'password'
    const inputType = isPassword && showPassword ? 'text' : type

    const baseClasses = `
      w-full px-4 py-3 
      border rounded-xl
      bg-white dark:bg-gray-800
      text-gray-900 dark:text-white
      placeholder-gray-400 dark:placeholder-gray-500
      transition-all duration-200
      text-sm
      disabled:opacity-50 disabled:cursor-not-allowed
    `

    const stateClasses = error
      ? 'border-red-300 dark:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:border-red-500'
      : success
      ? 'border-green-300 dark:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:border-green-500'
      : 'border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500'

    const paddingClasses = icon ? 'pl-11' : ''
    const rightPaddingClasses = (rightIcon || isPassword) ? 'pr-11' : ''

    return (
      <div className="space-y-1.5">
        {label && (
          <label 
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          {/* Left icon */}
          {icon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              {icon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            type={inputType}
            className={`${baseClasses} ${stateClasses} ${paddingClasses} ${rightPaddingClasses} ${className}`}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            {...props}
          />

          {/* Right icon / Password toggle / Loading */}
          {(rightIcon || isPassword || isLoading) && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-gray-300 border-t-orange-500 rounded-full animate-spin" />
              ) : isPassword ? (
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              ) : rightIcon}
            </div>
          )}
        </div>

        {/* Messages */}
        {error && (
          <p id={`${inputId}-error`} className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400" role="alert">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </p>
        )}
        {success && !error && (
          <p className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            {success}
          </p>
        )}
        {hint && !error && !success && (
          <p id={`${inputId}-hint`} className="flex items-center gap-1.5 text-sm text-gray-500">
            <Info className="w-3.5 h-3.5 flex-shrink-0" />
            {hint}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

// Textarea variant
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const generatedId = useId()
    const textareaId = id || generatedId

    return (
      <div className="space-y-1.5">
        {label && (
          <label 
            htmlFor={textareaId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          className={`
            w-full px-4 py-3 
            border rounded-xl
            bg-white dark:bg-gray-800
            text-gray-900 dark:text-white
            placeholder-gray-400 dark:placeholder-gray-500
            transition-all duration-200
            text-sm
            resize-y min-h-[100px]
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error 
              ? 'border-red-300 dark:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:border-red-500' 
              : 'border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500'
            }
            ${className}
          `}
          aria-invalid={error ? 'true' : 'false'}
          {...props}
        />

        {error && (
          <p className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400" role="alert">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-sm text-gray-500">{hint}</p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

// Select variant
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options: Array<{ value: string; label: string; disabled?: boolean }>
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, className = '', id, ...props }, ref) => {
    const generatedId = useId()
    const selectId = id || generatedId

    return (
      <div className="space-y-1.5">
        {label && (
          <label 
            htmlFor={selectId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <select
          ref={ref}
          id={selectId}
          className={`
            w-full px-4 py-3 
            border rounded-xl
            bg-white dark:bg-gray-800
            text-gray-900 dark:text-white
            transition-all duration-200
            text-sm
            cursor-pointer
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error 
              ? 'border-red-300 dark:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:border-red-500' 
              : 'border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500'
            }
            ${className}
          `}
          aria-invalid={error ? 'true' : 'false'}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map(opt => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>

        {error && (
          <p className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400" role="alert">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-sm text-gray-500">{hint}</p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'
