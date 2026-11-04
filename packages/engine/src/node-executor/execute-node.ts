import type { Outcome } from '@easter-workflow-builder/core';
import { executeAgentStep } from './execute-agent-step.ts';
import { executeBranch } from './execute-branch.ts';
import { executeErrorHandler } from './execute-error-handler.ts';
import { executeFanOut } from './execute-fan-out.ts';
import { executeHumanApproval } from './execute-human-approval.ts';
import { executeJoinAiSynthesis } from './execute-join-ai-synthesis.ts';
import { executeJoinMerge } from './execute-join-merge.ts';
import { executeJoinScript } from './execute-join-script.ts';
import { executeLoop } from './execute-loop.ts';
import { executeScript } from './execute-script.ts';
import { executeStart } from './execute-start.ts';
import { executeSubWorkflow } from './execute-sub-workflow.ts';
import type { WellFormedNodeConfig } from '../run-validation/well-formed-node-config.ts';
import type { ExecuteNodeRequest } from './execute-node-request.ts';
import type { NodeExecutionResult } from './node-executor-result.ts';
import type { NodeExecutorDependencies } from './node-executor-dependencies.ts';

type JoinNodeConfig = Extract<WellFormedNodeConfig, { readonly type: 'join' }>;

/**
 * A `join` node két módjának szétválasztása **önálló függvényben**, nem a
 * diszpécser `case 'join'` ágába ágyazott `switch`-ként. Az ok gyakorlati: egy
 * beágyazott, minden ágán visszatérő `switch` a `sonarjs/no-fallthrough`
 * szabálynak akkor is fallthrough-nak látszik, ha a fordító tudja, hogy a
 * külső eset vége elérhetetlen ("End this switch case with an unconditional
 * break, continue, return or throw statement"). Külön függvényben a `switch`
 * maga a törzs, tehát nincs külső eset, amiből ki lehetne esni - és a
 * kimerítőség ugyanúgy fordítási idejű marad
 * (`switch-exhaustiveness-check`).
 *
 * A `script` mód a közös szkript végrehajtón fut (`execute-join-script.ts`,
 * SPEC-014 5.8).
 */
function executeJoinNode(
  config: JoinNodeConfig,
  request: ExecuteNodeRequest,
  dependencies: NodeExecutorDependencies,
): Promise<Outcome<NodeExecutionResult>> {
  const { instance, runContext, graph, joinInputs } = request;
  switch (config.mode) {
    case 'merge': {
      return Promise.resolve(executeJoinMerge({ instance, config, joinInputs }, dependencies.ports));
    }
    case 'script': {
      return executeJoinScript(
        { instance, config, runContext, joinInputs, stopSignal: request.stopSignal },
        dependencies.ports,
      );
    }
    case 'ai_synthesis': {
      return executeJoinAiSynthesis(
        {
          instance,
          config,
          descriptor: request.descriptor,
          runContext,
          graph,
          sessionSourceNodes: request.sessionSourceNodes,
          sessionInstances: request.sessionInstances,
          structuredOutputValidator: request.structuredOutputValidator,
          joinInputs,
        },
        dependencies.ports,
        dependencies.concurrencyGate,
        dependencies.agentQueryRegistry,
      );
    }
  }
}

/**
 * A node végrehajtó diszpécser: a motor egyetlen belépési pontja egy
 * futtathatónak talált node **példány** végrehajtásához (SPEC-004 5.
 * szekció, PLAN-005 T-005-24). A `run-supervisor` (T-005-25) ezt hívja, és
 * a `NodeExecutionOutcome` értékből építi a `scheduling` téma
 * `SchedulingEvent` bemenetét (`node-executor-outcome.ts`).
 *
 * **A `switch` kimerítő.** A bemenet configja `WellFormedNodeConfig`, a
 * `malformed_node_config` ellenőrzés típusszintű szűkítése (SPEC-008 O-33): a
 * választatlan `join` ág nem jut ide, tehát nincs sosem futó `case null`. A
 * `script` node és a `join` `script` módja a SPEC-014 5.8 óta végrehajtható, a
 * közös szkript végrehajtón (`execute-script.ts`).
 *
 * **Miért nem `async` a függvény.** Öt végrehajtó szinkron (`start`,
 * `branch`, `fan_out`, `loop`, `join` `merge`: egyik sem vár külső
 * eseményre), hét pedig `Promise`-t ad (`agent_step`, `join`
 * `ai_synthesis`, `human_approval`, `sub_workflow`, `error_handler`, és a
 * két szkript ág). Egy
 * `async` burkoló a szinkron ágakat is egy mikrotaszkkal késleltetné, és a
 * `require-await` szabály miatt egy felesleges `await`-et is igényelne; a
 * `Promise.resolve(...)` burkolás ezzel szemben pontosan azt fejezi ki, ami
 * történik, és a szinkron ágak sorrendje megfigyelhető marad a tesztekben
 * (ugyanaz az elv, mint a `concurrency-gate` szinkron visszahívásánál).
 */
export function executeNode(
  request: ExecuteNodeRequest,
  dependencies: NodeExecutorDependencies,
): Promise<Outcome<NodeExecutionResult>> {
  const { ports } = dependencies;

  if (request.kind === 'error_handler') {
    return executeErrorHandler(
      {
        instance: request.instance,
        config: request.config,
        failedErrorKind: request.failedErrorKind,
        failedAttempt: request.failedAttempt,
        stopSignal: request.stopSignal,
      },
      ports,
    );
  }

  const { config, instance, runContext, graph } = request;

  switch (config.type) {
    case 'start': {
      return Promise.resolve(executeStart({ instance, input: request.runInput }, ports));
    }
    case 'branch': {
      return Promise.resolve(
        executeBranch({ instance, config, runContext, availableBranchKeys: request.availableBranchKeys }, ports),
      );
    }
    case 'fan_out': {
      return Promise.resolve(executeFanOut({ instance, config, runContext }, ports));
    }
    case 'loop': {
      return Promise.resolve(executeLoop({ instance, config, runContext }, ports));
    }
    case 'join': {
      return executeJoinNode(config, request, dependencies);
    }
    case 'agent_step': {
      return executeAgentStep(
        {
          instance,
          config,
          descriptor: request.descriptor,
          runContext,
          graph,
          sessionSourceNodes: request.sessionSourceNodes,
          sessionInstances: request.sessionInstances,
          structuredOutputValidator: request.structuredOutputValidator,
        },
        ports,
        dependencies.concurrencyGate,
        dependencies.agentQueryRegistry,
      );
    }
    case 'human_approval': {
      return executeHumanApproval({ instance, config, runContext }, ports, dependencies.approvalRegistry);
    }
    case 'script': {
      return executeScript(
        { instance, nodeType: 'script', script: config, runContext, stopSignal: request.stopSignal },
        ports,
      );
    }
    case 'sub_workflow': {
      return executeSubWorkflow(
        { instance, config, graph, executedInstances: request.executedInstances },
        ports,
        dependencies.childWorkflowRunner,
      );
    }
  }
}
