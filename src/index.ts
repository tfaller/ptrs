import { useMemoPointer, usePointer, useStatePointer } from "./hooks";
import { ptrs } from "./ptrs";
import { createPointer, Pointer } from "./pointer";
import { subscribe } from "./subscriber";

export {
    createPointer,
    ptrs,
    subscribe,
    useMemoPointer,
    usePointer,
    useStatePointer,
}

export type {
    Pointer
}