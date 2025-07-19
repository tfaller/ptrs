import { mutate } from "./mutate";

test("mutate with simple object", () => {
    const base = { name: "Thomas" };

    const result = mutate(base, (value) => {
        value.name = "Lisa"
    })

    expect(base).not.toBe(result);
    expect(result).toStrictEqual({ name: "Lisa" });
})


test("mutate nested object", () => {
    const base = { project: "ptrs", metadata: { version: 1 } };

    const result = mutate(base, (value) => {
        value.metadata.version = 2;
    })

    expect(base).not.toBe(result);
    expect(base.metadata).not.toBe(result.metadata);
    expect(result).toStrictEqual({ project: "ptrs", metadata: { version: 2 } });
})

test("mutate assign proxied object", () => {
    const base = { project: "ptrs", metadata: { version: 1 } };

    const result = mutate(base, (value) => {
        value.metadata = value.metadata
    })

    expect(base).not.toBe(result);
    expect(base.metadata).not.toBe(result.metadata);
    expect(result.metadata).toStrictEqual({ version: 1 });
})

test("mutate by using a getter", () => {
    const obj = mutate({
        next: 1,

        get run() {
            return this.next++;
        }
    }, (obj) => {
        expect(obj.run).toEqual(1);
    })

    expect(obj.next).toEqual(2);
})

test("mutate an array", () => {
    const base = [1, 2]

    const result = mutate(base, (value) => {
        value.push(3);
    })

    expect(base).not.toBe(result);
    expect(result).toStrictEqual([1, 2, 3]);
})

test("mutate with a symbol property", () => {
    const sym1 = Symbol("sym1")
    const sym2 = Symbol("sym2")

    const result = mutate({
        [sym1]: "test",
        [sym2]: ""
    }, (value) => {
        value[sym2] = value[sym1];
    })

    expect(result[sym1]).toEqual("test");
    expect(result[sym2]).toEqual("test");
})

test("mutate keeps prototype", () => {
    class Base {
        constructor(public name: string) { }
    }

    const base = new Base("Thomas");

    const result = mutate(base, (value) => {
        value.name = "Lisa";
    })

    expect(base).not.toBe(result);
    expect(result).toBeInstanceOf(Base);
    expect(result.name).toEqual("Lisa");
})