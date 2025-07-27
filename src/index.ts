import { useMemoPointer, usePointer, useStatePointer } from "./hooks";
import { createPointer, pointerSchema, NoPointer, Pointer, PointerValue } from "./pointer";
import { ptrs } from "./ptrs";
import { subscribe } from "./subscriber";

export {
    createPointer,
    pointerSchema,
    ptrs,
    subscribe,
    useMemoPointer,
    usePointer,
    useStatePointer,
}

export type {
    NoPointer,
    Pointer,
    PointerValue,
}