/**
 * フォームフィールド部品
 *
 * react-hook-form の register をそのまま渡せる入力部品群。
 */

import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { forwardRef } from 'react'

import styles from './Field.module.css'

interface FieldProps {
  label: string
  error?: string
  required?: boolean
  hint?: string
  children: ReactNode
}

export function Field({ label, error, required, hint, children }: FieldProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>
        {label}
        {required && <span className={styles.required}>必須</span>}
      </label>
      {children}
      {hint && <p className={styles.hint}>{hint}</p>}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}

export const TextInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function TextInput(props, ref) {
  return <input ref={ref} className={styles.input} {...props} />
})

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea(props, ref) {
  return <textarea ref={ref} className={styles.textarea} rows={3} {...props} />
})

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select(props, ref) {
  return <select ref={ref} className={styles.select} {...props} />
})

export const CheckboxLabel = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: string }
>(function CheckboxLabel({ label, ...rest }, ref) {
  return (
    <label className={styles.checkbox}>
      <input ref={ref} type="checkbox" {...rest} />
      {label}
    </label>
  )
})
