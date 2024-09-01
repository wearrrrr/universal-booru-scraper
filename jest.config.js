/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  testEnvironment: "node",
  transform: {
    "^.+.tsx?$": ["ts-jest", {}],
  },
  moduleNameMapper: {
    // @/*
    "^@/(.*)$": "<rootDir>/src/$1",
    // @util/*
    "^@util/(.*)$": "<rootDir>/src/util/$1",
    // @enum/*
    "^@enum/(.*)$": "<rootDir>/src/enum/$1",
  },
};
