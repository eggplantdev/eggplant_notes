import { createFormHook, createFormHookContexts, useStore } from '@tanstack/react-form'

import { FormInput } from '@/components/forms/form-components/form-input'
import { FormTextarea } from '@/components/forms/form-components/form-textarea'

const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts()

const { useAppForm, withForm } = createFormHook({
  fieldComponents: {
    Input: FormInput,
    Textarea: FormTextarea,
  },
  formComponents: {},
  fieldContext,
  formContext,
})

export {
  fieldContext,
  formContext,
  useFieldContext,
  useFormContext,
  useStore,
  useAppForm,
  withForm,
}
