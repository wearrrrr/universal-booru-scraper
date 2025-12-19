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
    "^@util/(.*)$": "<rootDir>/src/lib/util/$1",
    // @enum/*
    "^@enum/(.*)$": "<rootDir>/src/lib/enum/$1",
    // @lib/*
    "^@lib/(.*)$": "<rootDir>/src/lib/$1",
  },
};
