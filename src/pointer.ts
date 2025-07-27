import { mutate } from "./mutate";
import { usedPointers, watchUsedPointers } from "./ptrs";
import { subscriberTrigger } from "./subscriber";

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
    (NonNullable<T> extends object ? (PointerFunc<T> & ComplexPointer<NonNullable<T>>) : PointerFunc<T>)
    & NeverFunctionProp<T>

/**
 * Defines a valid pointer value.
 */
export type PointerValue<T> = T extends UndefinedToOptional<T> ? T : UndefinedToOptional<T>;

/**
 * Makes sure that a type is not a pointer.
 */
export type NoPointer<T> = T extends Pointer<any> ? never : T;

/**
 * The property should be handled like a pointer.
 */
export type PointerPropertyTypePointer = "pointer"

/**
 * The property is a function that mutates the pointer.
 * Can also be used for get-set properties where also the getter
 * changes the pointer.
 */
export type PointerPropertyTypeMutate = "mutate"

/**
 * The pointer is a function that computes values without changing the pointer.
 * This can be used as a performance optimization, because "mutate", the default 
 * function behavior, has an overhead of creating new pointer values.
 * Can also be used for properties that just act as a getter.
 */
export type PointerPropertyTypeReadonly = "readonly"

/**
 * The property has a readonly get and a mutating set function.
 */
export type PointerPropertyTypeGetSet = "get-set"

/**
 * All possible pointer property types.
 */
export type PointerPropertyType
    = PointerPropertyTypePointer
    | PointerPropertyTypeMutate
    | PointerPropertyTypeReadonly
    | PointerPropertyTypeGetSet

const PointerProperties: unique symbol = Symbol("PointerProperties");

/**
* Valid pointer signatures
*/
type PointerFunc<T> = {
    (): T;
    <V extends T>(value: NoPointer<V>): void;
}

type ComplexPointer<T extends object> =
    T extends Array<any> ? ArrayPointer<T> : ObjectPointer<T>;

type ArrayPointer<T> = T extends Array<infer I> ? {
    readonly [P in number]: Pointer<I>;
} & Omit<T, number> : never

type ObjectPointer<T extends object> = {
    [P in keyof T]-?: T[P] extends Function ? ObjectPointerFunctionProperty<T, P> : ObjectPointerProperty<T, P>;
}

type ObjectPointerProperty<T extends object, P extends keyof T> =
    T extends { [PointerProperties]: Partial<{ [PP in P]: Exclude<PointerPropertyType, PointerPropertyTypePointer> }> } ? T[P] : Pointer<T[P]>;

type ObjectPointerFunctionProperty<T extends object, P extends keyof T> =
    T extends { [PointerProperties]: Partial<{ [PP in P]: PointerPropertyTypePointer }> } ? Pointer<T[P]> : T[P];

/**
 * We can't hide function properties, otherwise the pointer would not be callable.
 * But we can make them never, so that they are not "usable".
 */
type NeverFunctionProp<T> = {
    [P in Exclude<keyof Function, keyof NonNullable<T>>]: never;
}

/**
 * Convert undefined value to optional property.
 */
type UndefinedToOptional<T> =
    T extends object
    ? (T extends any[]
        ? UndefinedToOptionalArray<T>
        : (T extends Function
            ? T // unchanged function
            : UndefinedToOptionalObject<T>))
    : T // primary data type

type UndefinedToOptionalArray<T> =
    T extends Array<infer I>
    ? Array<UndefinedToOptional<I>>
    : T

type UndefinedToOptionalObject<T> =
    { [K in keyof T as undefined extends T[K] ? never : K]: UndefinedToOptional<T[K]> } &
    { [K in keyof T as undefined extends T[K] ? K : never]?: UndefinedToOptional<Exclude<T[K], undefined>> }

/**
 * Whether the pointer update should bubble up
 */
let bubbleUp = true;

/**
 * Whether the initialization has been done.
 */
let initialized = false;

/**
 * Performs one-time initialization.
 */
const initialize = () => {
    initialized = true;

    // Arrays should work as expected, so we add a pointer schema to the array prototype.

    const arrayReadonly = [
        "at",
        "concat",
        "entries",
        "every",
        "filter",
        "find",
        "findIndex",
        "findLast",
        "findLastIndex",
        "flat",
        "flatMap",
        "forEach",
        "includes",
        "indexOf",
        "join",
        "keys",
        "lastIndexOf",
        "map",
        "reduce",
        "reduceRight",
        "slice",
        "some",
        "toLocaleString",
        "toString",
        "valueOf",
        "values",
        "with"
    ]

    Object.defineProperty(Array.prototype, PointerProperties, {
        configurable: false,
        enumerable: false,
        writable: false,
        value: Object.freeze({
            ...Object.fromEntries(Object.getOwnPropertyNames(Array.prototype).map(name => [
                name, arrayReadonly.includes(name) ? "readonly" : "mutate"
            ])),
            "length": "get-set",
        })
    })
}

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
export const createPointer = <T>(value: PointerValue<T>, setter?: (newData: typeof value) => void): Pointer<typeof value> => {
    if (!initialized) {
        initialize();
    }
    return createInternalPointer(value, setter)
}

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

    let propertyType = getPropertyType(thisPtr, name, value);

    const self = new Proxy(() => value, {

        apply(target, thisArg, argArray) {

            if (typeof value === "function" && propertyType !== "pointer") {
                // We allow "regular" function calls, if the object property is not threated as a pointer.
                // "this" is the pointer value of our thisPtr, so a call behaves like a normal method call.

                if (propertyType === "readonly") {
                    // readonly function, no mutate needed. "this" won't change.
                    return (value as Function).apply(thisPtr!(), argArray)
                }

                // Allow the function to mutate "this", which is the pointer value.
                let returnvalue
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

                if (newValue === value)
                    return;

                value = Object.freeze(newValue);
                propertyType = getPropertyType(thisPtr, name, value);
                bubbleUp && setter?.(value)

                subscriberTrigger(self);

                // we have to disable bubble up, while updating children
                const prevBubbleUp = bubbleUp
                bubbleUp = false;

                for (const prop in proxyProps) {
                    if (typeof value?.[prop as keyof typeof value] !== "function") {
                        proxyProps[prop].deref()?.(value?.[prop as keyof typeof value] as NoPointer<any>);
                    }
                }

                bubbleUp = prevBubbleUp;

            } else {
                throw new Error('Pointer can only be called with 0 or 1 arguments.');
            }
        },

        get(target, prop) {

            const type = getPropertyType(self, prop, undefined)

            if (type !== "pointer") {
                // Try to handle as normal property
                let propValue

                if (type === "mutate") {
                    // A getter that mutates the pointer value.
                    self(mutate(value!, (newValue: any) => {
                        propValue = Reflect.get(newValue, prop, newValue);
                    }) as NoPointer<T>)
                } else {
                    propValue = value?.[prop as keyof typeof value];
                }

                // Should it be a function, we can't return the raw value, 
                // we have to proxy it. It is probably a method that
                // acts upon the pointer value.
                if (typeof propValue !== "function") {
                    return propValue
                }
            }

            let p = proxyProps[prop]?.deref()

            if (!p) {
                const propValue = value?.[prop as keyof typeof value]

                proxyProps[prop] = new WeakRef(p = createInternalPointer(propValue, (newValue) => {

                    if (value === undefined) {
                        // "this" is undefined. We will create it.
                        // There is however an issue: We don't now the "schema".
                        // We just can assume a plain object or array.
                        if (typeof prop === "string" && parseInt(prop, 10).toString() === prop) {
                            value = [] as T;
                        } else {
                            value = {} as T;
                        }
                    }

                    value = mutate(value!, (value) => {
                        if (newValue === undefined) {
                            // By convention we delete the property for undefined values.
                            // A optional property is far more common than a property that is set to undefined.
                            Reflect.deleteProperty(value, prop);
                        } else {
                            Reflect.set(value, prop, newValue, value);
                        }
                    })

                    propertyType = getPropertyType(thisPtr, name, value);
                    Object.freeze(value);
                    setter?.(value)

                    subscriberTrigger(self);

                }, self, prop))
            }

            return p
        },

        set(target, prop, propValue): boolean {

            if (getPropertyType(self, prop, undefined) !== "pointer") {
                // property schema allows to set the property
                self(mutate(value!, (newValue) => {
                    Reflect.set(newValue, prop, propValue, newValue);
                }) as NoPointer<T>)
                return true;
            }

            // we don't allow any change besides special cases
            return false;
        }

    }) as Pointer<T>

    return self;
}

const getPropertyType = (
    thisPtr: Pointer<any> | undefined,
    propName: PropertyKey | undefined,
    propValue: any): PointerPropertyType => {

    if (thisPtr && propName) {
        const t = thisPtr()
        const pointerProps = t?.[PointerProperties]

        if (pointerProps && propName in pointerProps) {
            return pointerProps[propName];
        }
    }

    return typeof propValue === "function" ? "mutate" : "pointer";
}

/**
 * Adds a schema to a value that defines how a pointer for the given value should behave.
 * @param objectOrClass 
 * @param map A map defining the properties. This map will be frozen, so it can't be changed later.
 * @returns 
 */
export const pointerSchema = <
    T extends object,
    M extends Partial<Record<keyof T, PointerPropertyType>>,
    O extends T & { [PointerProperties]: M }>
    (objectOrClass: T, map: M): O => {

    const withMap = objectOrClass as unknown as O
    withMap[PointerProperties] = Object.freeze(map)
    return withMap
}