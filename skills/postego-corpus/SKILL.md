---
name: postego-corpus
description: Use when working with the PostEgo atom corpus: editing atoms, auditing coherence, proposing new atoms, checking causal lines, or refining definitions. Treat the current Russian corpus as the canonical model of reality inside PostEgo, prioritize its internal causality and levels over external theories, and discuss formulations before publishing unless the user explicitly asks to publish.
---

# PostEgo Corpus Skill

Use this skill whenever the task is about:
- editing or proposing atom definitions
- auditing the corpus
- checking coherence between atoms
- deciding whether a new atom is needed
- tracing causal lines inside PostEgo

## Core Presupposition

The current RU corpus is both:
- the canon of PostEgo
- the working model of reality inside PostEgo

The English corpus in `/Users/denisalesev/Projects/Post_ego/content/en/Атомы` must be kept semantically synchronized with the current RU corpus unless the user explicitly asks to postpone English updates.

Do not treat the corpus as a loose note collection. Treat it as an internally assembled model with its own causal logic.

Do not assume the corpus has a single center, master atom, or one privileged line that explains everything. Treat it as a network of bearing lines that intersect without collapsing into one hub.

External philosophy, psychology, neuroscience, or spiritual traditions may help orientation, but they do not override the corpus.

Always read `/Users/denisalesev/Projects/Post_ego/CANON.md` before substantial work.
Always work inside `/Users/denisalesev/Projects/Post_ego` when the user refers to the PostEgo corpus. Do not substitute sibling folders such as `/Users/denisalesev/Projects/🔬 PostEgo`, even if they contain related drafts, mirrors, or older working layers.

## Default Workflow

1. Read the target atom.
2. Read every atom it links to before proposing or editing wording.
3. Check that each linked atom's current definition still coheres with the proposed formulation.
4. If working on a RU atom, inspect the corresponding EN atom too: update it if stale, create it if missing.
5. If the atom sits on a bearing line, inspect adjacent causal nodes too.
6. Identify the level of the concept: presupposition, property, mechanism, process, transition, state, mode, model, consequence, etc.
7. Reconstruct the local line as:
   cause -> mechanism -> consequence
8. Check whether the proposed meaning is already expressed by the existing network.
9. Prefer tightening an existing atom over adding a new one.

## Non-Negotiables

1. Do not redefine atoms from external systems if the corpus already defines them.
2. Do not create “god-atoms” that explain the whole corpus.
3. Do not force direct links when the relation is only indirect.
4. Do not collapse different levels into one atom unless the corpus clearly requires it.
5. Do not treat `Дихотомия` and `Двойственность` as the same thing.
6. Do not treat `Предсказуемость` and `Базовая безопасность` as the same thing.
7. Do not treat `Делегитимация ума` and `Смерть эго` as the same thing.
8. Do not use deleted lines such as `Праджня` or `Путь знания` as current canonical foundations unless the user explicitly reopens them.
9. Do not propose or publish atom wording without first checking the current definitions of the atoms it links to.
10. Do not leave RU and EN versions semantically out of sync after publishing atom changes unless the user explicitly approves that mismatch.

## User Preference Rules

1. Work in Russian unless the user asks otherwise.
2. When discussing atom text, use plain text rather than code-block dumps unless the user asks for code-style formatting.
3. Show only the atoms that actually change.
4. Avoid long trees of variants when the user wants a direct formulation.
5. If the user provides an exact formulation that fits the canon, prefer it over stylistic rewriting.
6. If the user has clearly lived through a line and is assembling it from experience, privilege that line over elegant but detached abstraction.

## Audit Mode

When asked to audit the corpus:

1. Start from the bearing lines, not isolated atoms.
2. Check for:
   - direct contradictions
   - duplicated meanings
   - weak parent atoms
   - missing causal bridges
   - nodes that are isolated but important
3. Distinguish between:
   - a true contradiction
   - an indirect but valid relation
   - a merely underlinked node
4. Give findings first, then overall conclusions.

## Publish Rule

Discuss first and publish only when the user explicitly signals publication, unless the user directly asks for code/file changes as the main task.

When publishing:
- edit the relevant RU atom(s)
- sync the corresponding EN atom(s) in the same round
- keep the change narrow
- avoid unrelated cleanup
- commit and push clearly
