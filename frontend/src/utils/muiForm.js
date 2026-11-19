// react-hook-form ke register() ko MUI TextField ke saath jodne ka chhota madadgaar.
// MUI me ref root div par jaata hai, isliye input tak inputRef se pahunchate hain.
//   <TextField label="Name" {...field(register, errors, 'name')} />
export function field(register, errors, name) {
  const { ref, ...rest } = register(name)
  const message = errors[name]?.message
  return { ...rest, inputRef: ref, error: Boolean(message), helperText: message }
}

// Uncontrolled (register) field me value code se aaye (setValue/reset) to MUI ko pata nahi chalta aur label value ke upar chhap jaata he.
// watch('name') ki value yahan do: value ho to label upar rahe, warna MUI apne aap sambhale.
//   <TextField label="State" {...field(register, errors, 'state')} slotProps={labelShrink(values.state)} />
export function labelShrink(value) {
  return { inputLabel: { shrink: Boolean(value) || undefined } }
}
