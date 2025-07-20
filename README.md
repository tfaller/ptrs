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
import { createPointer, useStatePointer } from "ptrs"

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

## Working with array pointers

Pointers can also be used to manage arrays and their elements. You can create a pointer to an array,
and then use property pointers to access or update individual items or the array as a whole.

```tsx
// Create a pointer to an array
const items = useStatePointer(["foo", "bar"])

// Read and update like any other pointer
items()
items(["bar", "foo"])

// Index access will result in a pointer to that index
const firstItem = items[0]
firstItem()
firstItem("new value")

// All Array methods and length work as usual.
// Mutating methods trigger a pointer update.
items.length // 2
items.push("baz")
items.length // 3
```

## Working with object methods

Pointers to objects support direct method calls for mutation, just like you would use methods on a regular object.
When they mutate `this` or any descendant properties, the object pointer will update.

```tsx
const state = useStatePointer({ 
    amount: 0,

    increment() {
        this.amount++
    }

    dispatch(type: string, value: any) {
        if (type === "amount") {
            this.amount = value
        }
    }
})

state.increment()
state.amount() // 1
state.dispatch("amount", 2)
state.amount() // 2
```

## Customizing pointer behavior with `pointerSchema`

You can use `pointerSchema` to define how specific properties or methods of an object should behave when used as a pointer.
This is useful for advanced scenarios where you want to control whether a property acts as a pointer, a readonly getter or function,
a mutating function, or a get-set property. The default of normal properties is to act as a pointer and for methods to act as a mutating function.

```ts
import { pointerSchema, createPointer } from "ptrs"

// Mark a method as readonly (does not mutate state)
const state = createPointer(pointerSchema(
    {
        count: 0,
        getCount() {
            return this.count
        }
    },
    { getCount: "readonly" }
))

state.getCount() // 0

// Mark a property as get-set
const state2 = createPointer(pointerSchema(
    {
        _value: 1,
        get value() { return this._value },
        set value(v) { this._value = v }
    }, 
    { value: "get-set" }
))

state2.value // 1
state2.value = 2
state2.value // 2
```

**Property types you can specify:**
- `"pointer"`: Treat as a pointer (default for non-methods)
- `"readonly"`: Method or getter that does not mutate state
- `"mutate"`: Method or getter that mutates state
- `"get-set"`: Property with getter and setter