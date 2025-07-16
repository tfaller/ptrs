import { mutate } from "./mutate";
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
    (T extends object ? (PointerFunc<T> & ComplexPointer<Required<T>>) : PointerFunc<T>)
    & NeverFunctionProp<T>

/**
* Valid pointer signatures
*/
type PointerFunc<T> = {
    (): T;
    (value: T): void;
}

type ComplexPointer<T extends object> =
    T extends Array<any> ? ArrayPointer<T> : ObjectPointer<T>;

type ArrayPointer<T> = T extends Array<infer I> ? {
    readonly [P in number]: Pointer<I>;
} & Omit<T, number> : never

type ObjectPointer<T extends object> = {
    [P in keyof T]: T[P] extends Function ? T[P] : Pointer<T[P]>;
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
 * To enforce this the value will be frozen.
 * 
 * @param value The initial value of the pointer.
 * @param setter A function that will be called when the pointer is set.
 */
export const createPointer = <T>(value: T, setter?: (newData: T) => void): Pointer<T> =>
    createInternalPointer(value, setter)

const createInternalPointer = <T>(
    value: T,
    setter?: (newData: T) => void,
    thisPtr?: Pointer<any>,
    name?: string | symbol) => {

    // Prevent any changes, the pointer will handle changes itself.
    // We don't perform a deep freeze, because that would be too expensive.
    // If a prop will be accessed by pointer, it will be frozen later anyway.
    Object.freeze(value);

    // when we are an object, we store here our proxied properties
    const proxyProps: Record<PropertyKey, WeakRef<Pointer<any>>> = {}

    let thisIsArray = Array.isArray(thisPtr?.())

    const self = new Proxy(() => value, {

        apply(target, thisArg, argArray) {

            if (thisIsArray && bubbleUp && Object.hasOwn(Array.prototype, name!)) {
                // Special array handling.
                // Array props can't be set or get, like any other normal property
                // However, they can be used normally.
                // Note: Only when bubbleUp, because that means, that a user called this function.

                if (name! in ARRAY_MUTATING) {

                    const arr = [...(thisPtr as Pointer<any[]>)()]
                    const result = arr[name as keyof typeof arr](...argArray)
                    thisPtr!(arr)

                    return result
                }

                // non mutating array method
                const arr = thisPtr!() as any[];
                return arr[name as keyof typeof arr](...argArray);
            }

            if (typeof value === "function") {
                // We allow function calls. That function could mutate the pointer value, 
                // so that we have to run it as a mutate action.
                let returnvalue = undefined

                // Allow the function to mutate "this", which is the pointer value.
                const newThis = mutate(thisPtr!(), (newThis) => {
                    returnvalue = (value as Function).apply(newThis, argArray)
                })

                bubbleUp = false
                thisPtr!(newThis)
                bubbleUp = true

                return returnvalue;
            }

            // called when the pointer value should be changed or read

            if (argArray.length === 0) {

                if (watchUsedPointers)
                    usedPointers.add(self);

                return value;

            } else if (argArray.length === 1) {
                const newValue = argArray[0];

                // parent could have changed, recheck this
                thisIsArray = Array.isArray(thisPtr?.());

                if (newValue === value)
                    return;

                value = Object.freeze(newValue);
                bubbleUp && setter?.(value)

                subscribers.get(self)?.forEach(sub => {
                    sub.deref()?.((old: number) => old + 1)
                })

                // we have to disable bubble up, while updating children
                const prevBubbleUp = bubbleUp
                bubbleUp = false;

                for (const prop in proxyProps) {
                    if (typeof value?.[prop as keyof typeof value] !== "function") {
                        proxyProps[prop].deref()?.(value?.[prop as keyof typeof value]);
                    }
                }

                bubbleUp = prevBubbleUp;

            } else {
                throw new Error('Pointer can only be called with 0 or 1 arguments.');
            }
        },

        get(target, prop) {

            if (prop === "length" && Array.isArray(value)) {
                // We allow array access basically like a normal array.
                // Which means length is not a pointer value, but an actual value.
                // A pointer to length would be kind of strange.
                // If someone wants to subscribe to length changes, they can use the array pointer itself.
                return value.length;
            }

            let p = proxyProps[prop]?.deref()

            if (!p) {
                const propValue = value?.[prop as keyof typeof value]

                proxyProps[prop] = new WeakRef(p = createInternalPointer(propValue, (newValue) => {

                    if (Array.isArray(value)) {
                        value = [...value] as T
                        value[prop as keyof typeof value] = newValue as typeof value[keyof typeof value];
                    } else {
                        value = { ...value, [prop]: newValue }
                    }

                    Object.freeze(value);
                    setter?.(value)

                }, self, prop))
            }

            return p
        },

        set(target, prop, propValue): boolean {

            if (prop === "length" && Array.isArray(value)) {
                // special length handling, like in the "get" for arrays
                const arr = [...value]
                arr.length = propValue;
                self(arr as T);
                return true;
            }

            // we don't allow any change besides special cases
            return false;
        }

    }) as Pointer<T>

    return self;
}

/**
 * Array mutating methods that will change the array in place.
 * A pointer will update its value to the new array.
 */
const ARRAY_MUTATING = {
    'push': true,
    'pop': true,
    'unshift': true,
    'shift': true,
    'splice': true,
    'fill': true,
    'copyWithin': true,
    'reverse': true,
    'sort': true
};