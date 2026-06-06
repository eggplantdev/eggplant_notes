type FormErrorPropsT = {
  message?: string
}

// Single source for error styling, shared by field-level (FormInput) and form-level (auth pages) errors.
export function FormError({ message }: FormErrorPropsT) {
  if (!message) return null
  return <p className="text-destructive text-sm">{message}</p>
}
