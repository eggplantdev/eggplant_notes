import { createFormHook, createFormHookContexts, useStore } from '@tanstack/react-form'

import { FormInput } from '@/components/forms/form-components/form-input'

const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts()

const { useAppForm } = createFormHook({
  fieldComponents: {
    Input: FormInput,
  },
  formComponents: {},
  fieldContext,
  formContext,
})

export { fieldContext, formContext, useFieldContext, useFormContext, useStore, useAppForm }
