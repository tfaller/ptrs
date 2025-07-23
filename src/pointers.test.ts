import { createPointer, pointerSchema } from "./pointer";

test("array index access", () => {
    const base = [0]
    const p = createPointer(base);
    const p0 = p[0];

    expect(p0()).toBe(0);

    p0(1);

    expect(base).toStrictEqual([0]);
    expect(base).not.toBe(p());
    expect(p()).toStrictEqual([1]);
    expect(p0()).toBe(1);
})

test("array length", () => {
    const base = [1, 2]
    const p = createPointer(base);

    expect(p.length).toBe(2);

    p.push(3);

    expect(p.length).toBe(3);
    expect(base).toStrictEqual([1, 2]);
    expect(p()).toStrictEqual([1, 2, 3]);
});

test("array iteration", () => {
    const base = [1, 2, 3]
    const p = createPointer(base);

    const items: number[] = [];
    for (const item of p) {
        items.push(item);
    }

    expect(items).toStrictEqual(base);
})

test("sparse array", () => {
    const base: number[] = [];
    const p = createPointer(base);
    const p1 = p[1];

    expect(p1()).toBe(undefined);

    p.length = 3;

    expect(p1()).toBe(undefined);
    expect(p.length).toBe(3);

    p1(1);

    expect(base).toStrictEqual([]);
    expect(p1()).toBe(1);
    expect(p()).toStrictEqual([, 1, ,]);
    expect(p()).not.toBe(base);
    expect(p.length).toBe(3);
})

test("array push", () => {
    const base = [1]
    const p = createPointer(base);
    const p1 = p[1];

    expect(p1()).toBe(undefined);

    const result = p.push(2);

    expect(result).toBe(2);
    expect(base).toStrictEqual([1]);
    expect(p()).toStrictEqual([1, 2]);
    expect(p()).not.toBe(base);
    expect(p1()).toBe(2);
})

test("array pop", () => {
    const base = [1, 2]
    const p = createPointer(base);
    const p1 = p[1];

    expect(p1()).toBe(2);

    const result = p.pop();

    expect(result).toBe(2);
    expect(base).toStrictEqual([1, 2]);
    expect(p()).toStrictEqual([1]);
    expect(p()).not.toBe(base);
    expect(p1()).toBe(undefined);
})

test("array splice", () => {
    const base = [1, 2, 3]
    const p = createPointer(base);
    const p1 = p[1];

    expect(p1()).toBe(2);

    const result = p.splice(1, 1);

    expect(result).toStrictEqual([2]);
    expect(base).toStrictEqual([1, 2, 3]);
    expect(p()).toStrictEqual([1, 3]);
    expect(p()).not.toBe(base);
    expect(p1()).toBe(3);
})

test("array unshift", () => {
    const base = [1, 2]
    const p = createPointer(base);
    const p0 = p[0];

    expect(p0()).toBe(1);

    const result = p.unshift(0);

    expect(result).toBe(3);
    expect(base).toStrictEqual([1, 2]);
    expect(p()).toStrictEqual([0, 1, 2]);
    expect(p()).not.toBe(base);
    expect(p0()).toBe(0);
})

test("array shift", () => {
    const base = [1, 2]
    const p = createPointer(base);
    const p0 = p[0];

    expect(p0()).toBe(1);

    const result = p.shift();

    expect(result).toBe(1);
    expect(base).toStrictEqual([1, 2]);
    expect(p()).toStrictEqual([2]);
    expect(p()).not.toBe(base);
    expect(p0()).toBe(2);
})

test("array fill", () => {
    const base = [1, 2, 3]
    const p = createPointer(base);

    const result = p.fill(0);

    expect(base).toStrictEqual([1, 2, 3]);
    expect(p()).toStrictEqual([0, 0, 0]);
    expect(p()).not.toBe(base);
    expect(p()).toBe(result);
})

test("array copyWithin", () => {
    const base = [1, 2, 3]
    const p = createPointer(base);

    const result = p.copyWithin(0, 1);

    expect(base).toStrictEqual([1, 2, 3]);
    expect(p()).toStrictEqual([2, 3, 3]);
    expect(p()).not.toBe(base);
    expect(p()).toBe(result);
})

test("array reverse", () => {
    const base = [1, 2, 3]
    const p = createPointer(base);

    const result = p.reverse();

    expect(base).toStrictEqual([1, 2, 3]);
    expect(p()).toStrictEqual([3, 2, 1]);
    expect(p()).not.toBe(base);
    expect(p()).toBe(result);
})

test("array sort", () => {
    const base = [3, 1, 2]
    const p = createPointer(base);

    const result = p.sort();

    expect(base).toStrictEqual([3, 1, 2]);
    expect(p()).toStrictEqual([1, 2, 3]);
    expect(p()).not.toBe(base);
    expect(p()).toBe(result);
})

test("array join", () => {
    const base = ["Hello", "World"]
    const p = createPointer(base);

    const result = p.join(" ");

    expect(base).toStrictEqual(["Hello", "World"]);
    expect(p()).toBe(base);
    expect(result).toBe("Hello World");
})

test("optional property", () => {
    type Item = { name: string, predecessor?: Item }
    const p = createPointer({ name: "v2", predecessor: { name: "v1" } } as Item);

    expect(p.predecessor.name()).toBe("v1");

    p.predecessor(undefined)

    expect(p()).toStrictEqual({ name: "v2" });
})

test("frozen pointer value", () => {
    const base: Record<string, string> = {
        "name": "Thomas"
    }
    const p = createPointer(base);

    expect(() => {
        p().name = "Lisa";
    }).toThrow("Cannot assign to read only property 'name' of object '#<Object>'");

    // base got also frozen
    expect(() => {
        base["key"] = "value";
    }).toThrow("Cannot add property key, object is not extensible");

    // pointer still works
    p({ "name": "Lisa" })
    expect(p().name).toBe("Lisa");

    expect(() => {
        p().name = "Thomas";
    }).toThrow("Cannot assign to read only property 'name' of object '#<Object>'");
})

test("mutating pointer method", () => {
    const base = {
        amount: 1,

        increment(amount: number) {
            return this.amount += amount;
        }
    }

    const p = createPointer(base);
    const result = p.increment(2)

    expect(result).toBe(3);
    expect(base.amount).toBe(1);
    expect(p().amount).toBe(3);
})


test("pointerSchema changes method to pointer", () => {
    const arrowFunc = (i: number) => i;
    const base = pointerSchema({
        arrowFunc
    }, { arrowFunc: "pointer" })

    const p = createPointer(base);
    const result = p.arrowFunc()

    expect(result).toEqual(arrowFunc);
})

test("pointerSchema changes method to readonly", () => {
    const base = pointerSchema({
        amount: 1,

        increment(amount: number) {
            return this.amount += amount;
        },

        current() {
            return this.amount;
        }
    }, { increment: "readonly", current: "readonly" })

    const p = createPointer(base);

    expect(p.amount()).toEqual(1);

    expect(() => {
        p.increment(1);
    }).toThrow("Cannot assign to read only property 'amount' of object '#<Object>'");
})

test("pointerSchema for get-set property", () => {
    const base = pointerSchema({
        a: 1,

        get amount() {
            return this.a;
        },

        set amount(value: number) {
            this.a = value;
        }

    }, { amount: "get-set" })

    const p = createPointer(base);

    expect(p.amount).toEqual(1);

    p.amount = 2;
    expect(p.amount).toEqual(2);
})

test("pointerSchema for mutate get property", () => {
    const base = pointerSchema({
        a: 1,

        get amount() {
            return this.a++;
        },

        get amountError() {
            return this.a++;
        },

    }, { amount: "mutate", amountError: "readonly" })

    const p = createPointer(base);

    expect(p.amount).toEqual(1);
    expect(p.amount).toEqual(2);

    expect(() => {
        p.amountError;
    }).toThrow("Cannot assign to read only property 'a' of object '#<Object>'");
})

// Typescript typing tests

if (false) {
    const x = createPointer({ name: "Thomas" });
    // @ts-expect-error
    x(x); // not allowed, its a pointer, not a pointer value
}