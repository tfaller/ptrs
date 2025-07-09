# ptrs

Manage your state with pointers.

> npm i ptrs

## Basic concepts

React state handling and data flow can be tedious.
You have to think about immutability and how to pass data around to other components.
This can be even trickier when you have to deal with hooks. As a consequence, a
component or hook could update too much or too little. This can be solved by using pointers.
Pointers themselves are immutable, but they mutate their values in a React-compatible way.

```tsx
// general purpose pointer, like for a global state
const pointer = createPointer("foo")

// React hook for a state pointer
const pointer = useStatePointer("foo")

pointer() // access the value
pointer("bar") // change the value

// also works for properties
const pointer = useStatePointer({foo: {bar: "foo"}})
pointer.foo.bar()
pointer.foo.bar("bar")

// simple prop usage
<Foobar foo={pointer.foo} bar={pointer.foo.bar} />
```

## Usage in components

Because pointers are immutable, React doesn't know when to re-render a component.
There are two preferred methods to use a pointer as render input.

```tsx
const globalBar: Pointer<string>

// usePointer hook.
const Foobar = (props: {bar: Pointer<string>}) => {
    const { bar } = props
    usePointer(bar, globalBar) // re-render when any of these change
    return <>{bar()} and {globalBar()}</>
}

// "ptrs" component wrapper.
const Foobar = ptrs((props: {bar: Pointer<string>}) => {
    return <>{bar()} and {globalBar()}</> // just read from a pointer
})
```

Usage of pointers in hooks, like useEffect or useCallback, is simple. Just use them.
If a pointer value is only used inside of a hook, `usePointer` or `ptrs` is not needed.

```tsx
// technically name is not needed as a dependency, but makes linters happy :)
const onChangeName = useCallback((newValue) => {
    if (name() !== newValue) {
        name(newValue)
    }
}, [name]) 
```