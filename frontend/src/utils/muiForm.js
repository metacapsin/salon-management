// react-hook-form ke register() ko MUI TextField ke saath jodne ka chhota madadgaar.
// MUI me ref root div par jaata hai, isliye input tak inputRef se pahunchate hain.
//   <TextField label="Name" {...field(register, errors, 'name')} />
export function field(register, errors, name) {
  const { ref, ...rest } = register(name)
  const message = errors[name]?.message
  return { ...rest, inputRef: ref, error: Boolean(message), helperText: message }
}
