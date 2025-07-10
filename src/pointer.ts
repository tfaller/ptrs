import { usedPointers, watchUsedPointers } from "./ptrs";
import { subscribers } from "./subscriber";

/**
 * A pointer references to an actual value. A pointer is stable and won't change
 * when the value changes. The value of a pointer can be accessed and changed.
 * 
 * ```
 * pointer() // gets the value
 * pointer(newValue) // sets a new value
 * ```
 */
export type Pointer<T> =
    (T extends object ? (PointerFunc<T> & ObjectPointer<Required<T>>) : PointerFunc<T>)
    & NeverFunctionProp<T>

/**
* Valid pointer signatures
*/
type PointerFunc<T> = {
    (): T;
    (value: T): void;
}

type ObjectPointer<T extends object> = {
    [P in keyof T]: Pointer<T[P]>;
}

/**
 * We can't hide function properties, otherwise the pointer would not be callable.
 * But we can make them never, so that they are not "usable".
 */
type NeverFunctionProp<T> = {
    [P in Exclude<keyof Function, keyof T>]: never;
}
/**
 * Whether the pointer update should bubble up
 */
let bubbleUp = true;

/**
 * Creates a pointer for a value. The given value is the initial value of the pointer.
 * The setter is called when the pointer is set to a new value, so an external state, like
 * a variable or useState, can be updated. However, that external state should not update its value anymore.
 * Updates must be done through the pointer itself, otherwise the pointer won't see the changes.
 * 
 * @param value The initial value of the pointer.
 * @param setter A function that will be called when the pointer is set.
 */
export const createPointer = <T>(value: T, setter?: (newData: T) => void): Pointer<T> => {
    // when we are an object, we store here our proxied properties
    const proxyProps: Record<PropertyKey, WeakRef<Pointer<any>>> = {}

    const self = new Proxy(() => value, {

        apply(target, thisArg, argArray) {

            // called when the pointer value should be changed or read

            if (argArray.length === 0) {

                if (watchUsedPointers)
                    usedPointers.add(self);

                return value;

            } else if (argArray.length === 1) {
                const newValue = argArray[0];

                if (newValue === value)
                    return;

                value = newValue;
                bubbleUp && setter?.(value)

                subscribers.get(self)?.forEach(sub => {
                    sub.deref()?.((old: number) => old + 1)
                })

                // we have to disable bubble up, while updating children
                const prevBubbleUp = bubbleUp
                bubbleUp = false;

                for (const prop in proxyProps) {
                    proxyProps[prop].deref()?.(value?.[prop as keyof typeof value]);
                }

                bubbleUp = prevBubbleUp;

            } else {
                throw new Error('Pointer can only be called with 0 or 1 arguments.');
            }
        },

        get(target, prop) {

            let p = proxyProps[prop]?.deref()

            if (!p) {
                const propValue = value?.[prop as keyof typeof value]

                proxyProps[prop] = new WeakRef(p = createPointer(propValue, (newValue) => {
                    value = { ...value, [prop]: newValue }
                    setter?.(value)
                }))
            }

            return p
        }
    })

    return self as Pointer<T>;
}