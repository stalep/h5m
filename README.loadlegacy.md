# Load Legacy

This adds two commands `load-legacy-tests` and `load-legacy-runs` that are used to convert the existing Horreum 
model into the h5m model. Run this with a local backup of a Horreum instance. 

*DO NOT* run these commands on a production database.

## Setup

Make sure `db-kind=postgresql` in `src/main/resources/application.properties` because the legacy model requires postgresql jsonpath.

```
quarkus.datasource.db-kind=postgresql
```

Then build h5m
```shell
mvn clean package -Pnative
```

## Command Overview

### load-legacy-tests

This command works by identifying the schemas used across all non-deleted runs for the test and creating a set of nodes that represent all the Transformers, Extractors, Labels, and Variables.
The new nodes de-duplicate reused Extractors and eliminate Variables that do not make changes to existing Labels.
There are no shared Nodes between Folders.

This command works by _creating_ new tables in the legacy schema. The tables represent all the `$schema` paths in the runs and datasets tables.
The new tables are created the first time the command is run against a legacy schema and can take several minutes.
The tables are re-used for subsequent calls to load.

### load-legacy-runs

This will load all non-deleted runs (optionally for a specific testId) into a Folder with the same name. 

> Note: The `Folder` needs to already exist so use load-legacy-tests before load-legacy-runs.

## Setup

Start with a postgresql instance running a copy of the Horreum database listening on port `6000`.
```bash
podman run --name hdb \
-v <backup_path>:/var/lib/postgresql/data:rw,Z \ 
-e POSTGRES_DB=horreum \
-e PGDATABASE=horreum \
-e POSTGRES_USER=<username> \
-e PGUSER=<username> \
-e PGPASSWORD=<password> \
-e POSTGRES_PASSWORD=<password> \ 
-p 6000:<containerPort> \
mirror.gcr.io/library/postgres:16
```
Start a postgres instance to run the h5m database
```bash
podman run --name h5m \
-e POSTGRES_DB=quarkus \
-e POSTGRES_USER=quarkus \
-e POSTGRES_PASSWORD=quarkus \
-p 5432:5432 \
mirror.gcr.io/library/postgres:17
```
Specify the database url in a `.env` file
```shell
quarkus.datasource.jdbc.url=jdbc:postgresql://0.0.0.0:5432/quarkus
```

Load all the legacy tests with
```bash
h5m load-legacy-tests username=<username> password=<password> url=jdbc:postgresql://0.0.0.0:6000/horreum
```

It can take several minutes for the first invocation against the Horreum database as h5m will be scanning all runs and datasets to create reference tables.

Loading all runs at once will overwhelm h5m using the default configuration. It is best to load a single test at a time
```bash
h5m load-legacy-runs testId=391 username=<username> password=<password> url=jdbc:postgresql://0.0.0.0:6000/horreum
```
Loading in this manner will allow the workQueue to empty (before h5m exits) rather than the loader thread flooding the unbounded queue.

## Unit Testing

There are two unit tests in `H5mTest` that are disabled because they rely on a running Horreum database. They are for debugging purposes and are not 
intended to be enabled. 

## How the Import Works

### Horreum's Data Pipeline

In Horreum, benchmark data flows through several layers:

1. **Run** — raw JSON uploaded by CI/benchmarks
2. **Transformer** — a JS function that restructures the raw JSON into normalized objects
3. **Dataset** — the transformer output, split into individual entries (1:N with runs)
4. **Labels** — extract specific values from each dataset using jsonpath + optional JS functions
5. **Variables** — aliases for labels used by change detection
6. **Change Detection** — FixedThreshold / RelativeDifference applied to variables

### h5m's Approach: Transformer-Free Label Wiring

h5m intentionally avoids the dataset concept. Instead of recreating Horreum's runtime
transformer→dataset→label pipeline, the import **parses the transformer function at import time**
and wires labels directly to raw run extractor nodes through the DAG.

For a test like `rhivos-perf-comprehensive`, the Horreum transformer takes 23 extractors
from the raw run (e.g., `$.stressng_workload[*].test_results`, `$.user`, `$.uuid`) and produces
normalized dataset objects. The import parses this function to understand the field mapping:
- `$.metadata.description` in the dataset → `$.description` in the raw run
- `$.results` in the dataset → `$.stressng_workload[*].test_results` (per workload type)
- `$.workload` in the dataset → a constant string per workload group

Labels then reference the raw extractors directly instead of going through a transformer+dataset layer.

#### The resulting DAG

```
root
├── description (sql, $.description)
├── ansible_facts (sql, $.ansible_facts)
├── stressng_results (sqlall, $.stressng_workload[*].test_results)
├── fio_results (sqlall, $.fio_workload[*].test_results)
├── ... other raw extractors ...
├── Description (jq alias → description)
├── Hostname (sql, $.ansible_facts.env.HOSTNAME → from ansible_facts)
├── Stress-ng Max IRQ Latency (sql, $.total_irq_latency.max → from stressng_timerlat_data)
├── FIO Mean Read IOPS (sqlall, $.jobs[*].read.iops → from fio_results)
├── SUT (js, combines shared metadata fields)
├── fingerprint (fp)
└── change detection nodes (rd/ft)
```

No transformer JS node. No dataset JQ node. Labels extract directly from the DAG.

#### Multi-transformer handling

Some Horreum tests have multiple transformers for the same target schema (schema version
evolution — e.g., `$.autobench_workload[*].results` vs `$.autobench_workload.data[*].results`).
The import merges extractors from all transformers and creates coalesce nodes for conflicting paths:
a primary node, an alternative node, and a JS coalesce that picks whichever produced data.

#### Fallback for complex transformers

When the parser can't handle a transformer function (e.g., keycloak-benchmark's complex iteration
logic with forEach loops), the import falls back to creating the traditional transformer+dataset
nodes. The fallback still loads and wires all target schema labels.

### Detection Node Source Ordering

`FixedThreshold` and `RelativeDifference` nodes store their source node IDs (fingerprint, groupBy,
range) in the config JSON, not relying on positional access to the `sources` list. This works around
Hibernate's cascade persist reordering `@OrderColumn` indices by entity ID.

## Test Results

### rhivos-perf-comprehensive (test 339, with parseable transformer)

- **Approach**: Direct wiring (transformer function parsed at import time)
- **Extractors**: 23 merged from 2 transformers, 15 with alternative paths (coalesce nodes)
- **Labels**: 32 of 36 produce values matching Horreum
- **Shared metadata** (Description, Hostname, Kernel, RHIVOS *, Run ID, UUID, etc.): exact match
- **Per-workload labels** (Stressor, Workers): return arrays instead of per-dataset scalars (correct for h5m's model)
- **Missing**: 4 Autobench labels need per-iteration value pairing ([#66](https://github.com/Hyperfoil/h5m/issues/66))

### keycloak-benchmark (test 347, with unparseable transformer)

- **Approach**: Fallback (transformer+dataset nodes created at runtime)
- **Labels**: All 14 Horreum label values match exactly
- **Datasets**: 11 splits match Horreum's 11 datasets

### boot-time-nightly-rhivos (test 294, no transformer)

- **Approach**: No-transform path (labels from multiple schema versions, merged with coalesce nodes)
- **Labels**: 60+ label nodes produce values from 5 schema versions
- **Simple labels** (Kernel Version, Start time, etc.): match Horreum
- **Known issues**: Merge node truncation for single-source values ([#67](https://github.com/Hyperfoil/h5m/issues/67)),
  complex multi-parameter JS functions can't be resolved ([#68](https://github.com/Hyperfoil/h5m/issues/68))