import * as React from "react"
import {
  FormProvider,
  useForm,
  type DefaultValues,
  type FieldValues,
  type SubmitHandler,
  type UseFormProps,
  type UseFormReturn,
} from "react-hook-form"
import type { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"

export type FormProps<TSchema extends z.ZodType<FieldValues, FieldValues>> = Omit<
  UseFormProps<z.input<TSchema>>,
  "resolver" | "defaultValues"
> & {
  schema: TSchema
  onSubmit: (
    values: z.output<TSchema>,
    form: UseFormReturn<z.input<TSchema>>,
  ) => void | Promise<void>
  defaultValues?: DefaultValues<z.input<TSchema>>
  children?: React.ReactNode
  formProps?: Omit<React.ComponentProps<"form">, "onSubmit">
}

export function Form<TSchema extends z.ZodType<FieldValues, FieldValues>>({
  schema,
  onSubmit,
  children,
  formProps,
  ...props
}: FormProps<TSchema>) {
  const form = useForm<z.input<TSchema>>({
    resolver: zodResolver(schema),
    ...props,
  })

  const submitHandler = React.useCallback<SubmitHandler<z.input<TSchema>>>(
    (values) => {
      return onSubmit(values as z.output<TSchema>, form)
    },
    [onSubmit, form],
  )

  const onFormSubmit = React.useCallback(
    (event: React.SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault()
      event.stopPropagation()

      void form.handleSubmit(submitHandler)(event)
    },
    [form, submitHandler],
  )

  return (
    <FormProvider {...form}>
      <form {...formProps} onSubmit={onFormSubmit}>
        <fieldset disabled={form.formState.isSubmitting}>{children}</fieldset>
      </form>
    </FormProvider>
  )
}
