import { createFormHook, createFormHookContexts, useStore } from '@tanstack/react-form'

import { FormInput } from '@/shared/components/forms/form-components/form-input'

const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts()

// Bound form hook with the minimal field-component set the auth forms need.
const { useAppForm } = createFormHook({
  fieldComponents: {
    Input: FormInput,
  },
  formComponents: {},
  fieldContext,
  formContext,
})

export { fieldContext, formContext, useFieldContext, useFormContext, useStore, useAppForm }
