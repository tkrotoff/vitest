import { getType, getColors, stringify, isObject, assertTypes } from '@vitest/utils';
export { setupColors } from '@vitest/utils';
import { diff } from '@vitest/utils/diff';
import { isMockFunction } from '@vitest/spy';
import { processError } from '@vitest/utils/error';
import { util } from 'chai';

const MATCHERS_OBJECT = Symbol.for("matchers-object");
const JEST_MATCHERS_OBJECT = Symbol.for("$$jest-matchers-object");
const GLOBAL_EXPECT = Symbol.for("expect-global");
const ASYMMETRIC_MATCHERS_OBJECT = Symbol.for("asymmetric-matchers-object");

if (!Object.prototype.hasOwnProperty.call(globalThis, MATCHERS_OBJECT)) {
  const globalState = /* @__PURE__ */ new WeakMap();
  const matchers = /* @__PURE__ */ Object.create(null);
  const customEqualityTesters = [];
  const assymetricMatchers = /* @__PURE__ */ Object.create(null);
  Object.defineProperty(globalThis, MATCHERS_OBJECT, {
    get: () => globalState
  });
  Object.defineProperty(globalThis, JEST_MATCHERS_OBJECT, {
    configurable: true,
    get: () => ({
      state: globalState.get(globalThis[GLOBAL_EXPECT]),
      matchers,
      customEqualityTesters
    })
  });
  Object.defineProperty(globalThis, ASYMMETRIC_MATCHERS_OBJECT, {
    get: () => assymetricMatchers
  });
}
function getState(expect) {
  return globalThis[MATCHERS_OBJECT].get(expect);
}
function setState(state, expect) {
  const map = globalThis[MATCHERS_OBJECT];
  const current = map.get(expect) || {};
  Object.assign(current, state);
  map.set(expect, current);
}

function getMatcherUtils() {
  const c = () => getColors();
  const EXPECTED_COLOR = c().green;
  const RECEIVED_COLOR = c().red;
  const INVERTED_COLOR = c().inverse;
  const BOLD_WEIGHT = c().bold;
  const DIM_COLOR = c().dim;
  function matcherHint(matcherName, received = "received", expected = "expected", options = {}) {
    const {
      comment = "",
      isDirectExpectCall = false,
      // seems redundant with received === ''
      isNot = false,
      promise = "",
      secondArgument = "",
      expectedColor = EXPECTED_COLOR,
      receivedColor = RECEIVED_COLOR,
      secondArgumentColor = EXPECTED_COLOR
    } = options;
    let hint = "";
    let dimString = "expect";
    if (!isDirectExpectCall && received !== "") {
      hint += DIM_COLOR(`${dimString}(`) + receivedColor(received);
      dimString = ")";
    }
    if (promise !== "") {
      hint += DIM_COLOR(`${dimString}.`) + promise;
      dimString = "";
    }
    if (isNot) {
      hint += `${DIM_COLOR(`${dimString}.`)}not`;
      dimString = "";
    }
    if (matcherName.includes(".")) {
      dimString += matcherName;
    } else {
      hint += DIM_COLOR(`${dimString}.`) + matcherName;
      dimString = "";
    }
    if (expected === "") {
      dimString += "()";
    } else {
      hint += DIM_COLOR(`${dimString}(`) + expectedColor(expected);
      if (secondArgument)
        hint += DIM_COLOR(", ") + secondArgumentColor(secondArgument);
      dimString = ")";
    }
    if (comment !== "")
      dimString += ` // ${comment}`;
    if (dimString !== "")
      hint += DIM_COLOR(dimString);
    return hint;
  }
  const SPACE_SYMBOL = "\xB7";
  const replaceTrailingSpaces = (text) => text.replace(/\s+$/gm, (spaces) => SPACE_SYMBOL.repeat(spaces.length));
  const printReceived = (object) => RECEIVED_COLOR(replaceTrailingSpaces(stringify(object)));
  const printExpected = (value) => EXPECTED_COLOR(replaceTrailingSpaces(stringify(value)));
  return {
    EXPECTED_COLOR,
    RECEIVED_COLOR,
    INVERTED_COLOR,
    BOLD_WEIGHT,
    DIM_COLOR,
    matcherHint,
    printReceived,
    printExpected
  };
}
function addCustomEqualityTesters(newTesters) {
  if (!Array.isArray(newTesters)) {
    throw new TypeError(
      `expect.customEqualityTesters: Must be set to an array of Testers. Was given "${getType(
        newTesters
      )}"`
    );
  }
  globalThis[JEST_MATCHERS_OBJECT].customEqualityTesters.push(
    ...newTesters
  );
}
function getCustomEqualityTesters() {
  return globalThis[JEST_MATCHERS_OBJECT].customEqualityTesters;
}

function equals(a, b, customTesters, strictCheck) {
  customTesters = customTesters || [];
  return eq(a, b, [], [], customTesters, strictCheck ? hasKey : hasDefinedKey);
}
const functionToString = Function.prototype.toString;
function isAsymmetric(obj) {
  return !!obj && typeof obj === "object" && "asymmetricMatch" in obj && isA("Function", obj.asymmetricMatch);
}
function hasAsymmetric(obj, seen = /* @__PURE__ */ new Set()) {
  if (seen.has(obj))
    return false;
  seen.add(obj);
  if (isAsymmetric(obj))
    return true;
  if (Array.isArray(obj))
    return obj.some((i) => hasAsymmetric(i, seen));
  if (obj instanceof Set)
    return Array.from(obj).some((i) => hasAsymmetric(i, seen));
  if (isObject(obj))
    return Object.values(obj).some((v) => hasAsymmetric(v, seen));
  return false;
}
function asymmetricMatch(a, b) {
  const asymmetricA = isAsymmetric(a);
  const asymmetricB = isAsymmetric(b);
  if (asymmetricA && asymmetricB)
    return void 0;
  if (asymmetricA)
    return a.asymmetricMatch(b);
  if (asymmetricB)
    return b.asymmetricMatch(a);
}
function eq(a, b, aStack, bStack, customTesters, hasKey2) {
  let result = true;
  const asymmetricResult = asymmetricMatch(a, b);
  if (asymmetricResult !== void 0)
    return asymmetricResult;
  const testerContext = { equals };
  for (let i = 0; i < customTesters.length; i++) {
    const customTesterResult = customTesters[i].call(testerContext, a, b, customTesters);
    if (customTesterResult !== void 0)
      return customTesterResult;
  }
  if (a instanceof Error && b instanceof Error)
    return a.message === b.message;
  if (typeof URL === "function" && a instanceof URL && b instanceof URL)
    return a.href === b.href;
  if (Object.is(a, b))
    return true;
  if (a === null || b === null)
    return a === b;
  const className = Object.prototype.toString.call(a);
  if (className !== Object.prototype.toString.call(b))
    return false;
  switch (className) {
    case "[object Boolean]":
    case "[object String]":
    case "[object Number]":
      if (typeof a !== typeof b) {
        return false;
      } else if (typeof a !== "object" && typeof b !== "object") {
        return Object.is(a, b);
      } else {
        return Object.is(a.valueOf(), b.valueOf());
      }
    case "[object Date]": {
      const numA = +a;
      const numB = +b;
      return numA === numB || Number.isNaN(numA) && Number.isNaN(numB);
    }
    case "[object RegExp]":
      return a.source === b.source && a.flags === b.flags;
  }
  if (typeof a !== "object" || typeof b !== "object")
    return false;
  if (isDomNode(a) && isDomNode(b))
    return a.isEqualNode(b);
  let length = aStack.length;
  while (length--) {
    if (aStack[length] === a)
      return bStack[length] === b;
    else if (bStack[length] === b)
      return false;
  }
  aStack.push(a);
  bStack.push(b);
  if (className === "[object Array]" && a.length !== b.length)
    return false;
  const aKeys = keys(a, hasKey2);
  let key;
  let size = aKeys.length;
  if (keys(b, hasKey2).length !== size)
    return false;
  while (size--) {
    key = aKeys[size];
    result = hasKey2(b, key) && eq(a[key], b[key], aStack, bStack, customTesters, hasKey2);
    if (!result)
      return false;
  }
  aStack.pop();
  bStack.pop();
  return result;
}
function keys(obj, hasKey2) {
  const keys2 = [];
  for (const key in obj) {
    if (hasKey2(obj, key))
      keys2.push(key);
  }
  return keys2.concat(
    Object.getOwnPropertySymbols(obj).filter(
      (symbol) => Object.getOwnPropertyDescriptor(obj, symbol).enumerable
    )
  );
}
function hasDefinedKey(obj, key) {
  return hasKey(obj, key) && obj[key] !== void 0;
}
function hasKey(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}
function isA(typeName, value) {
  return Object.prototype.toString.apply(value) === `[object ${typeName}]`;
}
function isDomNode(obj) {
  return obj !== null && typeof obj === "object" && "nodeType" in obj && typeof obj.nodeType === "number" && "nodeName" in obj && typeof obj.nodeName === "string" && "isEqualNode" in obj && typeof obj.isEqualNode === "function";
}
function fnNameFor(func) {
  if (func.name)
    return func.name;
  const matches = functionToString.call(func).match(/^(?:async)?\s*function\s*\*?\s*([\w$]+)\s*\(/);
  return matches ? matches[1] : "<anonymous>";
}
function getPrototype(obj) {
  if (Object.getPrototypeOf)
    return Object.getPrototypeOf(obj);
  if (obj.constructor.prototype === obj)
    return null;
  return obj.constructor.prototype;
}
function hasProperty(obj, property) {
  if (!obj)
    return false;
  if (Object.prototype.hasOwnProperty.call(obj, property))
    return true;
  return hasProperty(getPrototype(obj), property);
}
const IS_KEYED_SENTINEL = "@@__IMMUTABLE_KEYED__@@";
const IS_SET_SENTINEL = "@@__IMMUTABLE_SET__@@";
const IS_ORDERED_SENTINEL = "@@__IMMUTABLE_ORDERED__@@";
function isImmutableUnorderedKeyed(maybeKeyed) {
  return !!(maybeKeyed && maybeKeyed[IS_KEYED_SENTINEL] && !maybeKeyed[IS_ORDERED_SENTINEL]);
}
function isImmutableUnorderedSet(maybeSet) {
  return !!(maybeSet && maybeSet[IS_SET_SENTINEL] && !maybeSet[IS_ORDERED_SENTINEL]);
}
const IteratorSymbol = Symbol.iterator;
function hasIterator(object) {
  return !!(object != null && object[IteratorSymbol]);
}
function iterableEquality(a, b, customTesters = [], aStack = [], bStack = []) {
  if (typeof a !== "object" || typeof b !== "object" || Array.isArray(a) || Array.isArray(b) || !hasIterator(a) || !hasIterator(b))
    return void 0;
  if (a.constructor !== b.constructor)
    return false;
  let length = aStack.length;
  while (length--) {
    if (aStack[length] === a)
      return bStack[length] === b;
  }
  aStack.push(a);
  bStack.push(b);
  const filteredCustomTesters = [
    ...customTesters.filter((t) => t !== iterableEquality),
    iterableEqualityWithStack
  ];
  function iterableEqualityWithStack(a2, b2) {
    return iterableEquality(
      a2,
      b2,
      [...filteredCustomTesters],
      [...aStack],
      [...bStack]
    );
  }
  if (a.size !== void 0) {
    if (a.size !== b.size) {
      return false;
    } else if (isA("Set", a) || isImmutableUnorderedSet(a)) {
      let allFound = true;
      for (const aValue of a) {
        if (!b.has(aValue)) {
          let has = false;
          for (const bValue of b) {
            const isEqual = equals(aValue, bValue, filteredCustomTesters);
            if (isEqual === true)
              has = true;
          }
          if (has === false) {
            allFound = false;
            break;
          }
        }
      }
      aStack.pop();
      bStack.pop();
      return allFound;
    } else if (isA("Map", a) || isImmutableUnorderedKeyed(a)) {
      let allFound = true;
      for (const aEntry of a) {
        if (!b.has(aEntry[0]) || !equals(aEntry[1], b.get(aEntry[0]), filteredCustomTesters)) {
          let has = false;
          for (const bEntry of b) {
            const matchedKey = equals(aEntry[0], bEntry[0], filteredCustomTesters);
            let matchedValue = false;
            if (matchedKey === true)
              matchedValue = equals(aEntry[1], bEntry[1], filteredCustomTesters);
            if (matchedValue === true)
              has = true;
          }
          if (has === false) {
            allFound = false;
            break;
          }
        }
      }
      aStack.pop();
      bStack.pop();
      return allFound;
    }
  }
  const bIterator = b[IteratorSymbol]();
  for (const aValue of a) {
    const nextB = bIterator.next();
    if (nextB.done || !equals(aValue, nextB.value, filteredCustomTesters))
      return false;
  }
  if (!bIterator.next().done)
    return false;
  aStack.pop();
  bStack.pop();
  return true;
}
function hasPropertyInObject(object, key) {
  const shouldTerminate = !object || typeof object !== "object" || object === Object.prototype;
  if (shouldTerminate)
    return false;
  return Object.prototype.hasOwnProperty.call(object, key) || hasPropertyInObject(Object.getPrototypeOf(object), key);
}
function isObjectWithKeys(a) {
  return isObject(a) && !(a instanceof Error) && !Array.isArray(a) && !(a instanceof Date);
}
function subsetEquality(object, subset, customTesters = []) {
  const filteredCustomTesters = customTesters.filter((t) => t !== subsetEquality);
  const subsetEqualityWithContext = (seenReferences = /* @__PURE__ */ new WeakMap()) => (object2, subset2) => {
    if (!isObjectWithKeys(subset2))
      return void 0;
    return Object.keys(subset2).every((key) => {
      if (isObjectWithKeys(subset2[key])) {
        if (seenReferences.has(subset2[key]))
          return equals(object2[key], subset2[key], filteredCustomTesters);
        seenReferences.set(subset2[key], true);
      }
      const result = object2 != null && hasPropertyInObject(object2, key) && equals(object2[key], subset2[key], [
        ...filteredCustomTesters,
        subsetEqualityWithContext(seenReferences)
      ]);
      seenReferences.delete(subset2[key]);
      return result;
    });
  };
  return subsetEqualityWithContext()(object, subset);
}
function typeEquality(a, b) {
  if (a == null || b == null || a.constructor === b.constructor)
    return void 0;
  return false;
}
function arrayBufferEquality(a, b) {
  let dataViewA = a;
  let dataViewB = b;
  if (!(a instanceof DataView && b instanceof DataView)) {
    if (!(a instanceof ArrayBuffer) || !(b instanceof ArrayBuffer))
      return void 0;
    try {
      dataViewA = new DataView(a);
      dataViewB = new DataView(b);
    } catch {
      return void 0;
    }
  }
  if (dataViewA.byteLength !== dataViewB.byteLength)
    return false;
  for (let i = 0; i < dataViewA.byteLength; i++) {
    if (dataViewA.getUint8(i) !== dataViewB.getUint8(i))
      return false;
  }
  return true;
}
function sparseArrayEquality(a, b, customTesters = []) {
  if (!Array.isArray(a) || !Array.isArray(b))
    return void 0;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  const filteredCustomTesters = customTesters.filter((t) => t !== sparseArrayEquality);
  return equals(a, b, filteredCustomTesters, true) && equals(aKeys, bKeys);
}
function generateToBeMessage(deepEqualityName, expected = "#{this}", actual = "#{exp}") {
  const toBeMessage = `expected ${expected} to be ${actual} // Object.is equality`;
  if (["toStrictEqual", "toEqual"].includes(deepEqualityName))
    return `${toBeMessage}

If it should pass with deep equality, replace "toBe" with "${deepEqualityName}"

Expected: ${expected}
Received: serializes to the same string
`;
  return toBeMessage;
}
function pluralize(word, count) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

class AsymmetricMatcher {
  constructor(sample, inverse = false) {
    this.sample = sample;
    this.inverse = inverse;
  }
  // should have "jest" to be compatible with its ecosystem
  $$typeof = Symbol.for("jest.asymmetricMatcher");
  getMatcherContext(expect) {
    return {
      ...getState(expect || globalThis[GLOBAL_EXPECT]),
      equals,
      isNot: this.inverse,
      customTesters: getCustomEqualityTesters(),
      utils: {
        ...getMatcherUtils(),
        diff,
        stringify,
        iterableEquality,
        subsetEquality
      }
    };
  }
  // implement custom chai/loupe inspect for better AssertionError.message formatting
  // https://github.com/chaijs/loupe/blob/9b8a6deabcd50adc056a64fb705896194710c5c6/src/index.ts#L29
  [Symbol.for("chai/inspect")](options) {
    const result = stringify(this, options.depth, { min: true });
    if (result.length <= options.truncate)
      return result;
    return `${this.toString()}{\u2026}`;
  }
}
class StringContaining extends AsymmetricMatcher {
  constructor(sample, inverse = false) {
    if (!isA("String", sample))
      throw new Error("Expected is not a string");
    super(sample, inverse);
  }
  asymmetricMatch(other) {
    const result = isA("String", other) && other.includes(this.sample);
    return this.inverse ? !result : result;
  }
  toString() {
    return `String${this.inverse ? "Not" : ""}Containing`;
  }
  getExpectedType() {
    return "string";
  }
}
class Anything extends AsymmetricMatcher {
  asymmetricMatch(other) {
    return other != null;
  }
  toString() {
    return "Anything";
  }
  toAsymmetricMatcher() {
    return "Anything";
  }
}
class ObjectContaining extends AsymmetricMatcher {
  constructor(sample, inverse = false) {
    super(sample, inverse);
  }
  getPrototype(obj) {
    if (Object.getPrototypeOf)
      return Object.getPrototypeOf(obj);
    if (obj.constructor.prototype === obj)
      return null;
    return obj.constructor.prototype;
  }
  hasProperty(obj, property) {
    if (!obj)
      return false;
    if (Object.prototype.hasOwnProperty.call(obj, property))
      return true;
    return this.hasProperty(this.getPrototype(obj), property);
  }
  asymmetricMatch(other) {
    if (typeof this.sample !== "object") {
      throw new TypeError(
        `You must provide an object to ${this.toString()}, not '${typeof this.sample}'.`
      );
    }
    let result = true;
    const matcherContext = this.getMatcherContext();
    for (const property in this.sample) {
      if (!this.hasProperty(other, property) || !equals(this.sample[property], other[property], matcherContext.customTesters)) {
        result = false;
        break;
      }
    }
    return this.inverse ? !result : result;
  }
  toString() {
    return `Object${this.inverse ? "Not" : ""}Containing`;
  }
  getExpectedType() {
    return "object";
  }
}
class ArrayContaining extends AsymmetricMatcher {
  constructor(sample, inverse = false) {
    super(sample, inverse);
  }
  asymmetricMatch(other) {
    if (!Array.isArray(this.sample)) {
      throw new TypeError(
        `You must provide an array to ${this.toString()}, not '${typeof this.sample}'.`
      );
    }
    const matcherContext = this.getMatcherContext();
    const result = this.sample.length === 0 || Array.isArray(other) && this.sample.every(
      (item) => other.some((another) => equals(item, another, matcherContext.customTesters))
    );
    return this.inverse ? !result : result;
  }
  toString() {
    return `Array${this.inverse ? "Not" : ""}Containing`;
  }
  getExpectedType() {
    return "array";
  }
}
class Any extends AsymmetricMatcher {
  constructor(sample) {
    if (typeof sample === "undefined") {
      throw new TypeError(
        "any() expects to be passed a constructor function. Please pass one or use anything() to match any object."
      );
    }
    super(sample);
  }
  fnNameFor(func) {
    if (func.name)
      return func.name;
    const functionToString = Function.prototype.toString;
    const matches = functionToString.call(func).match(/^(?:async)?\s*function\s*\*?\s*([\w$]+)\s*\(/);
    return matches ? matches[1] : "<anonymous>";
  }
  asymmetricMatch(other) {
    if (this.sample === String)
      return typeof other == "string" || other instanceof String;
    if (this.sample === Number)
      return typeof other == "number" || other instanceof Number;
    if (this.sample === Function)
      return typeof other == "function" || other instanceof Function;
    if (this.sample === Boolean)
      return typeof other == "boolean" || other instanceof Boolean;
    if (this.sample === BigInt)
      return typeof other == "bigint" || other instanceof BigInt;
    if (this.sample === Symbol)
      return typeof other == "symbol" || other instanceof Symbol;
    if (this.sample === Object)
      return typeof other == "object";
    return other instanceof this.sample;
  }
  toString() {
    return "Any";
  }
  getExpectedType() {
    if (this.sample === String)
      return "string";
    if (this.sample === Number)
      return "number";
    if (this.sample === Function)
      return "function";
    if (this.sample === Object)
      return "object";
    if (this.sample === Boolean)
      return "boolean";
    return this.fnNameFor(this.sample);
  }
  toAsymmetricMatcher() {
    return `Any<${this.fnNameFor(this.sample)}>`;
  }
}
class StringMatching extends AsymmetricMatcher {
  constructor(sample, inverse = false) {
    if (!isA("String", sample) && !isA("RegExp", sample))
      throw new Error("Expected is not a String or a RegExp");
    super(new RegExp(sample), inverse);
  }
  asymmetricMatch(other) {
    const result = isA("String", other) && this.sample.test(other);
    return this.inverse ? !result : result;
  }
  toString() {
    return `String${this.inverse ? "Not" : ""}Matching`;
  }
  getExpectedType() {
    return "string";
  }
}
class CloseTo extends AsymmetricMatcher {
  precision;
  constructor(sample, precision = 2, inverse = false) {
    if (!isA("Number", sample))
      throw new Error("Expected is not a Number");
    if (!isA("Number", precision))
      throw new Error("Precision is not a Number");
    super(sample);
    this.inverse = inverse;
    this.precision = precision;
  }
  asymmetricMatch(other) {
    if (!isA("Number", other))
      return false;
    let result = false;
    if (other === Number.POSITIVE_INFINITY && this.sample === Number.POSITIVE_INFINITY) {
      result = true;
    } else if (other === Number.NEGATIVE_INFINITY && this.sample === Number.NEGATIVE_INFINITY) {
      result = true;
    } else {
      result = Math.abs(this.sample - other) < 10 ** -this.precision / 2;
    }
    return this.inverse ? !result : result;
  }
  toString() {
    return `Number${this.inverse ? "Not" : ""}CloseTo`;
  }
  getExpectedType() {
    return "number";
  }
  toAsymmetricMatcher() {
    return [
      this.toString(),
      this.sample,
      `(${pluralize("digit", this.precision)})`
    ].join(" ");
  }
}
const JestAsymmetricMatchers = (chai, utils) => {
  utils.addMethod(
    chai.expect,
    "anything",
    () => new Anything()
  );
  utils.addMethod(
    chai.expect,
    "any",
    (expected) => new Any(expected)
  );
  utils.addMethod(
    chai.expect,
    "stringContaining",
    (expected) => new StringContaining(expected)
  );
  utils.addMethod(
    chai.expect,
    "objectContaining",
    (expected) => new ObjectContaining(expected)
  );
  utils.addMethod(
    chai.expect,
    "arrayContaining",
    (expected) => new ArrayContaining(expected)
  );
  utils.addMethod(
    chai.expect,
    "stringMatching",
    (expected) => new StringMatching(expected)
  );
  utils.addMethod(
    chai.expect,
    "closeTo",
    (expected, precision) => new CloseTo(expected, precision)
  );
  chai.expect.not = {
    stringContaining: (expected) => new StringContaining(expected, true),
    objectContaining: (expected) => new ObjectContaining(expected, true),
    arrayContaining: (expected) => new ArrayContaining(expected, true),
    stringMatching: (expected) => new StringMatching(expected, true),
    closeTo: (expected, precision) => new CloseTo(expected, precision, true)
  };
};

function recordAsyncExpect(test, promise) {
  if (test && promise instanceof Promise) {
    promise = promise.finally(() => {
      const index = test.promises.indexOf(promise);
      if (index !== -1)
        test.promises.splice(index, 1);
    });
    if (!test.promises)
      test.promises = [];
    test.promises.push(promise);
  }
  return promise;
}
function wrapSoft(utils, fn) {
  return function(...args) {
    var _a;
    const test = utils.flag(this, "vitest-test");
    const state = (test == null ? void 0 : test.context._local) ? test.context.expect.getState() : getState(globalThis[GLOBAL_EXPECT]);
    if (!state.soft)
      return fn.apply(this, args);
    if (!test)
      throw new Error("expect.soft() can only be used inside a test");
    try {
      return fn.apply(this, args);
    } catch (err) {
      test.result || (test.result = { state: "fail" });
      test.result.state = "fail";
      (_a = test.result).errors || (_a.errors = []);
      test.result.errors.push(processError(err));
    }
  };
}

const JestChaiExpect = (chai, utils) => {
  const { AssertionError } = chai;
  const c = () => getColors();
  const customTesters = getCustomEqualityTesters();
  function def(name, fn) {
    const addMethod = (n) => {
      const softWrapper = wrapSoft(utils, fn);
      utils.addMethod(chai.Assertion.prototype, n, softWrapper);
      utils.addMethod(globalThis[JEST_MATCHERS_OBJECT].matchers, n, softWrapper);
    };
    if (Array.isArray(name))
      name.forEach((n) => addMethod(n));
    else
      addMethod(name);
  }
  ["throw", "throws", "Throw"].forEach((m) => {
    utils.overwriteMethod(chai.Assertion.prototype, m, (_super) => {
      return function(...args) {
        const promise = utils.flag(this, "promise");
        const object = utils.flag(this, "object");
        const isNot = utils.flag(this, "negate");
        if (promise === "rejects") {
          utils.flag(this, "object", () => {
            throw object;
          });
        } else if (promise === "resolves" && typeof object !== "function") {
          if (!isNot) {
            const message = utils.flag(this, "message") || "expected promise to throw an error, but it didn't";
            const error = {
              showDiff: false
            };
            throw new AssertionError(message, error, utils.flag(this, "ssfi"));
          } else {
            return;
          }
        }
        _super.apply(this, args);
      };
    });
  });
  def("withTest", function(test) {
    utils.flag(this, "vitest-test", test);
    return this;
  });
  def("toEqual", function(expected) {
    const actual = utils.flag(this, "object");
    const equal = equals(
      actual,
      expected,
      [...customTesters, iterableEquality]
    );
    return this.assert(
      equal,
      "expected #{this} to deeply equal #{exp}",
      "expected #{this} to not deeply equal #{exp}",
      expected,
      actual
    );
  });
  def("toStrictEqual", function(expected) {
    const obj = utils.flag(this, "object");
    const equal = equals(
      obj,
      expected,
      [
        ...customTesters,
        iterableEquality,
        typeEquality,
        sparseArrayEquality,
        arrayBufferEquality
      ],
      true
    );
    return this.assert(
      equal,
      "expected #{this} to strictly equal #{exp}",
      "expected #{this} to not strictly equal #{exp}",
      expected,
      obj
    );
  });
  def("toBe", function(expected) {
    const actual = this._obj;
    const pass = Object.is(actual, expected);
    let deepEqualityName = "";
    if (!pass) {
      const toStrictEqualPass = equals(
        actual,
        expected,
        [
          ...customTesters,
          iterableEquality,
          typeEquality,
          sparseArrayEquality,
          arrayBufferEquality
        ],
        true
      );
      if (toStrictEqualPass) {
        deepEqualityName = "toStrictEqual";
      } else {
        const toEqualPass = equals(
          actual,
          expected,
          [...customTesters, iterableEquality]
        );
        if (toEqualPass)
          deepEqualityName = "toEqual";
      }
    }
    return this.assert(
      pass,
      generateToBeMessage(deepEqualityName),
      "expected #{this} not to be #{exp} // Object.is equality",
      expected,
      actual
    );
  });
  def("toMatchObject", function(expected) {
    const actual = this._obj;
    return this.assert(
      equals(actual, expected, [...customTesters, iterableEquality, subsetEquality]),
      "expected #{this} to match object #{exp}",
      "expected #{this} to not match object #{exp}",
      expected,
      actual
    );
  });
  def("toMatch", function(expected) {
    const actual = this._obj;
    return this.assert(
      typeof expected === "string" ? actual.includes(expected) : actual.match(expected),
      `expected #{this} to match #{exp}`,
      `expected #{this} not to match #{exp}`,
      expected,
      actual
    );
  });
  def("toContain", function(item) {
    const actual = this._obj;
    if (typeof Node !== "undefined" && actual instanceof Node) {
      if (!(item instanceof Node))
        throw new TypeError(`toContain() expected a DOM node as the argument, but got ${typeof item}`);
      return this.assert(
        actual.contains(item),
        "expected #{this} to contain element #{exp}",
        "expected #{this} not to contain element #{exp}",
        item,
        actual
      );
    }
    if (typeof DOMTokenList !== "undefined" && actual instanceof DOMTokenList) {
      assertTypes(item, "class name", ["string"]);
      const isNot = utils.flag(this, "negate");
      const expectedClassList = isNot ? actual.value.replace(item, "").trim() : `${actual.value} ${item}`;
      return this.assert(
        actual.contains(item),
        `expected "${actual.value}" to contain "${item}"`,
        `expected "${actual.value}" not to contain "${item}"`,
        expectedClassList,
        actual.value
      );
    }
    if (typeof actual === "string" && typeof item === "string") {
      return this.assert(
        actual.includes(item),
        `expected #{this} to contain #{exp}`,
        `expected #{this} not to contain #{exp}`,
        item,
        actual
      );
    }
    if (actual != null && typeof actual !== "string")
      utils.flag(this, "object", Array.from(actual));
    return this.contain(item);
  });
  def("toContainEqual", function(expected) {
    const obj = utils.flag(this, "object");
    const index = Array.from(obj).findIndex((item) => {
      return equals(item, expected, customTesters);
    });
    this.assert(
      index !== -1,
      "expected #{this} to deep equally contain #{exp}",
      "expected #{this} to not deep equally contain #{exp}",
      expected
    );
  });
  def("toBeTruthy", function() {
    const obj = utils.flag(this, "object");
    this.assert(
      Boolean(obj),
      "expected #{this} to be truthy",
      "expected #{this} to not be truthy",
      obj,
      false
    );
  });
  def("toBeFalsy", function() {
    const obj = utils.flag(this, "object");
    this.assert(
      !obj,
      "expected #{this} to be falsy",
      "expected #{this} to not be falsy",
      obj,
      false
    );
  });
  def("toBeGreaterThan", function(expected) {
    const actual = this._obj;
    assertTypes(actual, "actual", ["number", "bigint"]);
    assertTypes(expected, "expected", ["number", "bigint"]);
    return this.assert(
      actual > expected,
      `expected ${actual} to be greater than ${expected}`,
      `expected ${actual} to be not greater than ${expected}`,
      actual,
      expected,
      false
    );
  });
  def("toBeGreaterThanOrEqual", function(expected) {
    const actual = this._obj;
    assertTypes(actual, "actual", ["number", "bigint"]);
    assertTypes(expected, "expected", ["number", "bigint"]);
    return this.assert(
      actual >= expected,
      `expected ${actual} to be greater than or equal to ${expected}`,
      `expected ${actual} to be not greater than or equal to ${expected}`,
      actual,
      expected,
      false
    );
  });
  def("toBeLessThan", function(expected) {
    const actual = this._obj;
    assertTypes(actual, "actual", ["number", "bigint"]);
    assertTypes(expected, "expected", ["number", "bigint"]);
    return this.assert(
      actual < expected,
      `expected ${actual} to be less than ${expected}`,
      `expected ${actual} to be not less than ${expected}`,
      actual,
      expected,
      false
    );
  });
  def("toBeLessThanOrEqual", function(expected) {
    const actual = this._obj;
    assertTypes(actual, "actual", ["number", "bigint"]);
    assertTypes(expected, "expected", ["number", "bigint"]);
    return this.assert(
      actual <= expected,
      `expected ${actual} to be less than or equal to ${expected}`,
      `expected ${actual} to be not less than or equal to ${expected}`,
      actual,
      expected,
      false
    );
  });
  def("toBeNaN", function() {
    return this.be.NaN;
  });
  def("toBeUndefined", function() {
    return this.be.undefined;
  });
  def("toBeNull", function() {
    return this.be.null;
  });
  def("toBeDefined", function() {
    const negate = utils.flag(this, "negate");
    utils.flag(this, "negate", false);
    if (negate)
      return this.be.undefined;
    return this.not.be.undefined;
  });
  def("toBeTypeOf", function(expected) {
    const actual = typeof this._obj;
    const equal = expected === actual;
    return this.assert(
      equal,
      "expected #{this} to be type of #{exp}",
      "expected #{this} not to be type of #{exp}",
      expected,
      actual
    );
  });
  def("toBeInstanceOf", function(obj) {
    return this.instanceOf(obj);
  });
  def("toHaveLength", function(length) {
    return this.have.length(length);
  });
  def("toHaveProperty", function(...args) {
    if (Array.isArray(args[0]))
      args[0] = args[0].map((key) => String(key).replace(/([.[\]])/g, "\\$1")).join(".");
    const actual = this._obj;
    const [propertyName, expected] = args;
    const getValue = () => {
      const hasOwn = Object.prototype.hasOwnProperty.call(actual, propertyName);
      if (hasOwn)
        return { value: actual[propertyName], exists: true };
      return utils.getPathInfo(actual, propertyName);
    };
    const { value, exists } = getValue();
    const pass = exists && (args.length === 1 || equals(expected, value, customTesters));
    const valueString = args.length === 1 ? "" : ` with value ${utils.objDisplay(expected)}`;
    return this.assert(
      pass,
      `expected #{this} to have property "${propertyName}"${valueString}`,
      `expected #{this} to not have property "${propertyName}"${valueString}`,
      expected,
      exists ? value : void 0
    );
  });
  def("toBeCloseTo", function(received, precision = 2) {
    const expected = this._obj;
    let pass = false;
    let expectedDiff = 0;
    let receivedDiff = 0;
    if (received === Number.POSITIVE_INFINITY && expected === Number.POSITIVE_INFINITY) {
      pass = true;
    } else if (received === Number.NEGATIVE_INFINITY && expected === Number.NEGATIVE_INFINITY) {
      pass = true;
    } else {
      expectedDiff = 10 ** -precision / 2;
      receivedDiff = Math.abs(expected - received);
      pass = receivedDiff < expectedDiff;
    }
    return this.assert(
      pass,
      `expected #{this} to be close to #{exp}, received difference is ${receivedDiff}, but expected ${expectedDiff}`,
      `expected #{this} to not be close to #{exp}, received difference is ${receivedDiff}, but expected ${expectedDiff}`,
      received,
      expected,
      false
    );
  });
  const assertIsMock = (assertion) => {
    if (!isMockFunction(assertion._obj))
      throw new TypeError(`${utils.inspect(assertion._obj)} is not a spy or a call to a spy!`);
  };
  const getSpy = (assertion) => {
    assertIsMock(assertion);
    return assertion._obj;
  };
  const ordinalOf = (i) => {
    const j = i % 10;
    const k = i % 100;
    if (j === 1 && k !== 11)
      return `${i}st`;
    if (j === 2 && k !== 12)
      return `${i}nd`;
    if (j === 3 && k !== 13)
      return `${i}rd`;
    return `${i}th`;
  };
  const formatCalls = (spy, msg, actualCall) => {
    if (spy.mock.calls) {
      msg += c().gray(`

Received: 

${spy.mock.calls.map((callArg, i) => {
        let methodCall = c().bold(`  ${ordinalOf(i + 1)} ${spy.getMockName()} call:

`);
        if (actualCall)
          methodCall += diff(actualCall, callArg, { omitAnnotationLines: true });
        else
          methodCall += stringify(callArg).split("\n").map((line) => `    ${line}`).join("\n");
        methodCall += "\n";
        return methodCall;
      }).join("\n")}`);
    }
    msg += c().gray(`

Number of calls: ${c().bold(spy.mock.calls.length)}
`);
    return msg;
  };
  const formatReturns = (spy, msg, actualReturn) => {
    msg += c().gray(`

Received: 

${spy.mock.results.map((callReturn, i) => {
      let methodCall = c().bold(`  ${ordinalOf(i + 1)} ${spy.getMockName()} call return:

`);
      if (actualReturn)
        methodCall += diff(actualReturn, callReturn.value, { omitAnnotationLines: true });
      else
        methodCall += stringify(callReturn).split("\n").map((line) => `    ${line}`).join("\n");
      methodCall += "\n";
      return methodCall;
    }).join("\n")}`);
    msg += c().gray(`

Number of calls: ${c().bold(spy.mock.calls.length)}
`);
    return msg;
  };
  def(["toHaveBeenCalledTimes", "toBeCalledTimes"], function(number) {
    const spy = getSpy(this);
    const spyName = spy.getMockName();
    const callCount = spy.mock.calls.length;
    return this.assert(
      callCount === number,
      `expected "${spyName}" to be called #{exp} times, but got ${callCount} times`,
      `expected "${spyName}" to not be called #{exp} times`,
      number,
      callCount,
      false
    );
  });
  def("toHaveBeenCalledOnce", function() {
    const spy = getSpy(this);
    const spyName = spy.getMockName();
    const callCount = spy.mock.calls.length;
    return this.assert(
      callCount === 1,
      `expected "${spyName}" to be called once, but got ${callCount} times`,
      `expected "${spyName}" to not be called once`,
      1,
      callCount,
      false
    );
  });
  def(["toHaveBeenCalled", "toBeCalled"], function() {
    const spy = getSpy(this);
    const spyName = spy.getMockName();
    const callCount = spy.mock.calls.length;
    const called = callCount > 0;
    const isNot = utils.flag(this, "negate");
    let msg = utils.getMessage(
      this,
      [
        called,
        `expected "${spyName}" to be called at least once`,
        `expected "${spyName}" to not be called at all, but actually been called ${callCount} times`,
        true,
        called
      ]
    );
    if (called && isNot)
      msg = formatCalls(spy, msg);
    if (called && isNot || !called && !isNot)
      throw new AssertionError(msg);
  });
  def(["toHaveBeenCalledWith", "toBeCalledWith"], function(...args) {
    const spy = getSpy(this);
    const spyName = spy.getMockName();
    const pass = spy.mock.calls.some((callArg) => equals(callArg, args, [...customTesters, iterableEquality]));
    const isNot = utils.flag(this, "negate");
    const msg = utils.getMessage(
      this,
      [
        pass,
        `expected "${spyName}" to be called with arguments: #{exp}`,
        `expected "${spyName}" to not be called with arguments: #{exp}`,
        args
      ]
    );
    if (pass && isNot || !pass && !isNot)
      throw new AssertionError(formatCalls(spy, msg, args));
  });
  def(["toHaveBeenNthCalledWith", "nthCalledWith"], function(times, ...args) {
    const spy = getSpy(this);
    const spyName = spy.getMockName();
    const nthCall = spy.mock.calls[times - 1];
    this.assert(
      equals(nthCall, args, [...customTesters, iterableEquality]),
      `expected ${ordinalOf(times)} "${spyName}" call to have been called with #{exp}`,
      `expected ${ordinalOf(times)} "${spyName}" call to not have been called with #{exp}`,
      args,
      nthCall
    );
  });
  def(["toHaveBeenLastCalledWith", "lastCalledWith"], function(...args) {
    const spy = getSpy(this);
    const spyName = spy.getMockName();
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1];
    this.assert(
      equals(lastCall, args, [...customTesters, iterableEquality]),
      `expected last "${spyName}" call to have been called with #{exp}`,
      `expected last "${spyName}" call to not have been called with #{exp}`,
      args,
      lastCall
    );
  });
  def(["toThrow", "toThrowError"], function(expected) {
    if (typeof expected === "string" || typeof expected === "undefined" || expected instanceof RegExp)
      return this.throws(expected);
    const obj = this._obj;
    const promise = utils.flag(this, "promise");
    const isNot = utils.flag(this, "negate");
    let thrown = null;
    if (promise === "rejects") {
      thrown = obj;
    } else if (promise === "resolves" && typeof obj !== "function") {
      if (!isNot) {
        const message = utils.flag(this, "message") || "expected promise to throw an error, but it didn't";
        const error = {
          showDiff: false
        };
        throw new AssertionError(message, error, utils.flag(this, "ssfi"));
      } else {
        return;
      }
    } else {
      let isThrow = false;
      try {
        obj();
      } catch (err) {
        isThrow = true;
        thrown = err;
      }
      if (!isThrow && !isNot) {
        const message = utils.flag(this, "message") || "expected function to throw an error, but it didn't";
        const error = {
          showDiff: false
        };
        throw new AssertionError(message, error, utils.flag(this, "ssfi"));
      }
    }
    if (typeof expected === "function") {
      const name = expected.name || expected.prototype.constructor.name;
      return this.assert(
        thrown && thrown instanceof expected,
        `expected error to be instance of ${name}`,
        `expected error not to be instance of ${name}`,
        expected,
        thrown
      );
    }
    if (expected instanceof Error) {
      return this.assert(
        thrown && expected.message === thrown.message,
        `expected error to have message: ${expected.message}`,
        `expected error not to have message: ${expected.message}`,
        expected.message,
        thrown && thrown.message
      );
    }
    if (typeof expected === "object" && "asymmetricMatch" in expected && typeof expected.asymmetricMatch === "function") {
      const matcher = expected;
      return this.assert(
        thrown && matcher.asymmetricMatch(thrown),
        "expected error to match asymmetric matcher",
        "expected error not to match asymmetric matcher",
        matcher,
        thrown
      );
    }
    throw new Error(`"toThrow" expects string, RegExp, function, Error instance or asymmetric matcher, got "${typeof expected}"`);
  });
  def(["toHaveReturned", "toReturn"], function() {
    const spy = getSpy(this);
    const spyName = spy.getMockName();
    const calledAndNotThrew = spy.mock.calls.length > 0 && spy.mock.results.some(({ type }) => type !== "throw");
    this.assert(
      calledAndNotThrew,
      `expected "${spyName}" to be successfully called at least once`,
      `expected "${spyName}" to not be successfully called`,
      calledAndNotThrew,
      !calledAndNotThrew,
      false
    );
  });
  def(["toHaveReturnedTimes", "toReturnTimes"], function(times) {
    const spy = getSpy(this);
    const spyName = spy.getMockName();
    const successfulReturns = spy.mock.results.reduce((success, { type }) => type === "throw" ? success : ++success, 0);
    this.assert(
      successfulReturns === times,
      `expected "${spyName}" to be successfully called ${times} times`,
      `expected "${spyName}" to not be successfully called ${times} times`,
      `expected number of returns: ${times}`,
      `received number of returns: ${successfulReturns}`,
      false
    );
  });
  def(["toHaveReturnedWith", "toReturnWith"], function(value) {
    const spy = getSpy(this);
    const spyName = spy.getMockName();
    const pass = spy.mock.results.some(({ type, value: result }) => type === "return" && equals(value, result));
    const isNot = utils.flag(this, "negate");
    const msg = utils.getMessage(
      this,
      [
        pass,
        `expected "${spyName}" to return with: #{exp} at least once`,
        `expected "${spyName}" to not return with: #{exp}`,
        value
      ]
    );
    if (pass && isNot || !pass && !isNot)
      throw new AssertionError(formatReturns(spy, msg, value));
  });
  def(["toHaveLastReturnedWith", "lastReturnedWith"], function(value) {
    const spy = getSpy(this);
    const spyName = spy.getMockName();
    const { value: lastResult } = spy.mock.results[spy.mock.results.length - 1];
    const pass = equals(lastResult, value);
    this.assert(
      pass,
      `expected last "${spyName}" call to return #{exp}`,
      `expected last "${spyName}" call to not return #{exp}`,
      value,
      lastResult
    );
  });
  def(["toHaveNthReturnedWith", "nthReturnedWith"], function(nthCall, value) {
    const spy = getSpy(this);
    const spyName = spy.getMockName();
    const isNot = utils.flag(this, "negate");
    const { type: callType, value: callResult } = spy.mock.results[nthCall - 1];
    const ordinalCall = `${ordinalOf(nthCall)} call`;
    if (!isNot && callType === "throw")
      chai.assert.fail(`expected ${ordinalCall} to return #{exp}, but instead it threw an error`);
    const nthCallReturn = equals(callResult, value);
    this.assert(
      nthCallReturn,
      `expected ${ordinalCall} "${spyName}" call to return #{exp}`,
      `expected ${ordinalCall} "${spyName}" call to not return #{exp}`,
      value,
      callResult
    );
  });
  def("toSatisfy", function(matcher, message) {
    return this.be.satisfy(matcher, message);
  });
  utils.addProperty(chai.Assertion.prototype, "resolves", function __VITEST_RESOLVES__() {
    const error = new Error("resolves");
    utils.flag(this, "promise", "resolves");
    utils.flag(this, "error", error);
    const test = utils.flag(this, "vitest-test");
    const obj = utils.flag(this, "object");
    if (typeof (obj == null ? void 0 : obj.then) !== "function")
      throw new TypeError(`You must provide a Promise to expect() when using .resolves, not '${typeof obj}'.`);
    const proxy = new Proxy(this, {
      get: (target, key, receiver) => {
        const result = Reflect.get(target, key, receiver);
        if (typeof result !== "function")
          return result instanceof chai.Assertion ? proxy : result;
        return async (...args) => {
          const promise = obj.then(
            (value) => {
              utils.flag(this, "object", value);
              return result.call(this, ...args);
            },
            (err) => {
              const _error = new AssertionError(
                `promise rejected "${utils.inspect(err)}" instead of resolving`,
                { showDiff: false }
              );
              _error.cause = err;
              _error.stack = error.stack.replace(error.message, _error.message);
              throw _error;
            }
          );
          return recordAsyncExpect(test, promise);
        };
      }
    });
    return proxy;
  });
  utils.addProperty(chai.Assertion.prototype, "rejects", function __VITEST_REJECTS__() {
    const error = new Error("rejects");
    utils.flag(this, "promise", "rejects");
    utils.flag(this, "error", error);
    const test = utils.flag(this, "vitest-test");
    const obj = utils.flag(this, "object");
    const wrapper = typeof obj === "function" ? obj() : obj;
    if (typeof (wrapper == null ? void 0 : wrapper.then) !== "function")
      throw new TypeError(`You must provide a Promise to expect() when using .rejects, not '${typeof wrapper}'.`);
    const proxy = new Proxy(this, {
      get: (target, key, receiver) => {
        const result = Reflect.get(target, key, receiver);
        if (typeof result !== "function")
          return result instanceof chai.Assertion ? proxy : result;
        return async (...args) => {
          const promise = wrapper.then(
            (value) => {
              const _error = new AssertionError(
                `promise resolved "${utils.inspect(value)}" instead of rejecting`,
                { showDiff: true, expected: new Error("rejected promise"), actual: value }
              );
              _error.stack = error.stack.replace(error.message, _error.message);
              throw _error;
            },
            (err) => {
              utils.flag(this, "object", err);
              return result.call(this, ...args);
            }
          );
          return recordAsyncExpect(test, promise);
        };
      }
    });
    return proxy;
  });
};

function getMatcherState(assertion, expect) {
  const obj = assertion._obj;
  const isNot = util.flag(assertion, "negate");
  const promise = util.flag(assertion, "promise") || "";
  const jestUtils = {
    ...getMatcherUtils(),
    diff,
    stringify,
    iterableEquality,
    subsetEquality
  };
  const matcherState = {
    ...getState(expect),
    customTesters: getCustomEqualityTesters(),
    isNot,
    utils: jestUtils,
    promise,
    equals,
    // needed for built-in jest-snapshots, but we don't use it
    suppressedErrors: []
  };
  return {
    state: matcherState,
    isNot,
    obj
  };
}
class JestExtendError extends Error {
  constructor(message, actual, expected) {
    super(message);
    this.actual = actual;
    this.expected = expected;
  }
}
function JestExtendPlugin(expect, matchers) {
  return (c, utils) => {
    Object.entries(matchers).forEach(([expectAssertionName, expectAssertion]) => {
      function expectWrapper(...args) {
        const { state, isNot, obj } = getMatcherState(this, expect);
        const result = expectAssertion.call(state, obj, ...args);
        if (result && typeof result === "object" && result instanceof Promise) {
          return result.then(({ pass: pass2, message: message2, actual: actual2, expected: expected2 }) => {
            if (pass2 && isNot || !pass2 && !isNot)
              throw new JestExtendError(message2(), actual2, expected2);
          });
        }
        const { pass, message, actual, expected } = result;
        if (pass && isNot || !pass && !isNot)
          throw new JestExtendError(message(), actual, expected);
      }
      const softWrapper = wrapSoft(utils, expectWrapper);
      utils.addMethod(globalThis[JEST_MATCHERS_OBJECT].matchers, expectAssertionName, softWrapper);
      utils.addMethod(c.Assertion.prototype, expectAssertionName, softWrapper);
      class CustomMatcher extends AsymmetricMatcher {
        constructor(inverse = false, ...sample) {
          super(sample, inverse);
        }
        asymmetricMatch(other) {
          const { pass } = expectAssertion.call(
            this.getMatcherContext(expect),
            other,
            ...this.sample
          );
          return this.inverse ? !pass : pass;
        }
        toString() {
          return `${this.inverse ? "not." : ""}${expectAssertionName}`;
        }
        getExpectedType() {
          return "any";
        }
        toAsymmetricMatcher() {
          return `${this.toString()}<${this.sample.map(String).join(", ")}>`;
        }
      }
      const customMatcher = (...sample) => new CustomMatcher(false, ...sample);
      Object.defineProperty(expect, expectAssertionName, {
        configurable: true,
        enumerable: true,
        value: customMatcher,
        writable: true
      });
      Object.defineProperty(expect.not, expectAssertionName, {
        configurable: true,
        enumerable: true,
        value: (...sample) => new CustomMatcher(true, ...sample),
        writable: true
      });
      Object.defineProperty(globalThis[ASYMMETRIC_MATCHERS_OBJECT], expectAssertionName, {
        configurable: true,
        enumerable: true,
        value: customMatcher,
        writable: true
      });
    });
  };
}
const JestExtend = (chai, utils) => {
  utils.addMethod(chai.expect, "extend", (expect, expects) => {
    chai.use(JestExtendPlugin(expect, expects));
  });
};

export { ASYMMETRIC_MATCHERS_OBJECT, Any, Anything, ArrayContaining, AsymmetricMatcher, GLOBAL_EXPECT, JEST_MATCHERS_OBJECT, JestAsymmetricMatchers, JestChaiExpect, JestExtend, MATCHERS_OBJECT, ObjectContaining, StringContaining, StringMatching, addCustomEqualityTesters, arrayBufferEquality, equals, fnNameFor, generateToBeMessage, getState, hasAsymmetric, hasProperty, isA, isAsymmetric, isImmutableUnorderedKeyed, isImmutableUnorderedSet, iterableEquality, pluralize, setState, sparseArrayEquality, subsetEquality, typeEquality };