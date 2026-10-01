import {
  HttpPageFetcher,
} from "../.v8-build/src/v8/acquisition/page-fetcher.js";

import {
  observeInternetFirstHop,
} from "../.v8-build/src/v8/intelligence/web-discovery/first-hop-observer.js";

const QUERY =
  process.argv
    .slice(2)
    .join(" ")
    .trim() ||
  "plastic injection molding";

const BOOTSTRAP_CORPUS = [
  {
    id: "iso:294-1",
    url:
      "https://www.iso.org/standard/67036.html",
    title:
      "ISO 294-1 Plastics Injection Moulding of Test Specimens",
    terms: [
      "plastics",
      "plastic",
      "injection",
      "moulding",
      "molding",
      "thermoplastic",
      "test specimens",
      "standards",
    ],
    authority:
      "AUTHORITATIVE_STANDARD",
  },

  {
    id: "iso:294-3",
    url:
      "https://www.iso.org/standard/76649.html",
    title:
      "ISO 294-3 Plastics Injection Moulding of Test Specimens",
    terms: [
      "plastics",
      "plastic",
      "injection",
      "moulding",
      "molding",
      "small plates",
      "test specimens",
      "standards",
    ],
    authority:
      "AUTHORITATIVE_STANDARD",
  },

  {
    id: "iso:294-4",
    url:
      "https://www.iso.org/standard/70413.html",
    title:
      "ISO 294-4 Plastics Injection Moulding Shrinkage",
    terms: [
      "plastics",
      "plastic",
      "injection",
      "moulding",
      "molding",
      "shrinkage",
      "test specimens",
      "standards",
    ],
    authority:
      "AUTHORITATIVE_STANDARD",
  },

  {
    id: "iso:294-5",
    url:
      "https://www.iso.org/standard/85835.html",
    title:
      "ISO 294-5 Plastics Injection Moulding Anisotropy",
    terms: [
      "plastics",
      "plastic",
      "injection",
      "moulding",
      "molding",
      "anisotropy",
      "flow direction",
      "test specimens",
      "standards",
    ],
    authority:
      "AUTHORITATIVE_STANDARD",
  },

  {
    id: "iso:20430",
    url:
      "https://committee.iso.org/standard/68000.html",
    title:
      "ISO 20430 Injection Moulding Machine Safety Requirements",
    terms: [
      "plastics",
      "plastic",
      "injection",
      "moulding",
      "molding",
      "machine",
      "safety",
      "standards",
    ],
    authority:
      "AUTHORITATIVE_STANDARD",
  },
];

console.log("");
console.log(
  "==============================================",
);
console.log(
  "NEXMOLD V8 FIRST-HOP INTERNET OBSERVER",
);
console.log(
  "==============================================",
);
console.log("");
console.log(
  `Query: ${QUERY}`,
);
console.log(
  "Discovery owner: V8",
);
console.log(
  "Search provider: NONE",
);
console.log(
  "Bootstrap: V8-owned explicit corpus",
);
console.log("");

const fetcher =
  new HttpPageFetcher({
    timeoutMs: 15000,
    maxBytes: 5 * 1024 * 1024,
  });

const result =
  await observeInternetFirstHop(
    QUERY,
    BOOTSTRAP_CORPUS,
    fetcher,
    {
      limit: 20,
    },
  );

console.log(
  `Bootstrap matches: ${result.bootstrap.matched.length}`,
);

for (
  const source of
    result.bootstrap.matched
) {
  console.log(
    `  BOOTSTRAP ${source.id}`,
  );
  console.log(
    `    ${source.url}`,
  );
}

console.log("");

console.log(
  `Pages observed: ${result.pagesObserved}`,
);

console.log(
  `Candidates accepted: ${result.observation.accepted}`,
);

console.log(
  `Candidates rejected: ${result.observation.rejected}`,
);

console.log(
  `Fetch errors: ${result.fetchErrors.length}`,
);

console.log("");

for (
  const candidate of
    result.observation.candidates
) {
  console.log(
    `[${candidate.kind}] ${candidate.normalizedUrl}`,
  );

  if (
    candidate.sourceUrl
  ) {
    console.log(
      `  observedFrom: ${candidate.sourceUrl}`,
    );
  }

  console.log(
    `  observedAt: ${candidate.discoveredAt}`,
  );

  if (
    candidate.title
  ) {
    console.log(
      `  title: ${candidate.title}`,
    );
  }
}

if (
  result.fetchErrors.length > 0
) {
  console.log("");
  console.log(
    "Fetch errors:",
  );

  for (
    const failure of
      result.fetchErrors
  ) {
    console.log(
      `  ${failure.url}`,
    );
    console.log(
      `    ${failure.error}`,
    );
  }
}

console.log("");

if (
  result.pagesObserved === 0
) {
  console.error(
    "V8 FIRST-HOP INTERNET OBSERVER: FAIL",
  );
  process.exitCode = 1;
} else {
  console.log(
    "V8 FIRST-HOP INTERNET OBSERVER: PASS",
  );
}

console.log("");