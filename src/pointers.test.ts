import { createPointer } from "./pointer";

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
    expect(p()).toStrictEqual([undefined, 1, undefined]);
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
