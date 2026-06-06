import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormError } from '@/components/forms/form-components/form-error'
import { useFieldContext } from '@/components/forms/hooks/form-hooks'
import type { FormControlPropsT } from '@/components/forms/types/form-types'
import { getFieldErrorText } from '@/components/forms/utils'

export function FormInput(props: FormControlPropsT) {
  const field = useFieldContext<string>()
  const isInvalid = field.state.meta.errors.length > 0

  return (
    <div className="grid gap-2">
      {props.label && <Label htmlFor={field.name}>{props.label}</Label>}
      <Input
        id={field.name}
        name={field.name}
        type={props.type}
        placeholder={props.placeholder}
        disabled={props.disabled}
        autoComplete={props.autoComplete}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        aria-invalid={isInvalid}
        className={props.className}
      />
      <FormError message={getFieldErrorText(field.state.meta.errors)} />
    </div>
  )
}
