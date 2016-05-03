"use strict"

const chalk = require("chalk")
// convention used in data tree: scripts, names and subs
// convention used in ASCII tree: label and nodes
const archy = require("archy")

const BUILTINS = [
  "publish",
  "install",
  "uninstall",
  "test",
  "stop",
  "start",
  "restart",
  "version"
]

// -s, --serial…
const RE_FLAGS = "(?:\\s+\-+\\w+)*"
// build, watch, build_client, build-client, build:*
const RE_NAME = "\\s+([a-z0-9_\\-]+)"
const RE_NAMES = "((?:\\s+[a-z0-9_:\\-\\*]+)+)"

const PRE = "pre"
const POST = "post"

// utils

const unique = array => [...new Set(array)]

const flatten = arrays => [].concat.apply([], arrays)

const getMatches = (re, str) => {
  const matches = []
  let m
  while ((m = re.exec(str)) !== null) {
    matches.push({match: m[1], index: m[2]})
  }
  return matches
}


function archify (scripts, alpha) {
  let names = Object.keys(scripts)
  if (alpha) {
    names = names.sort()
  }
  return {
    label: `${names.length} scripts`,
    nodes: names.map(n => scripts[n])
  }
}

// add color formatting
function getLabel (script) {
  const name = script.isPre || script.isPost
    ? chalk.cyan(script.name)
    : chalk.bold(script.name)

  return name + chalk.dim(` — ${script.cmd}`)
}

function isLifeCycleScript (prefix, name, scripts) {
  const re = new RegExp("^" + prefix)
  const root = name.slice(prefix.length)
  return Boolean(name.match(re) && (scripts[root] || ~BUILTINS.indexOf(root)))
}

function getSubNames (name, scripts) {
  const cmd = scripts[name]

  const subNames = [].concat(
    getRunScripts(cmd),
    getRunAllScripts(cmd)
  ).filter(x => x) // not null

  return getExistingSubNames(unique(subNames), scripts)
}

function getExistingSubNames (names, scripts) {
  return expandWildcard(names, scripts).filter(n => scripts[n])
}

function expandWildcard (names, scripts) {
  return flatten(names.map(n => {
    const sp = n.split(":")
    const star = sp.pop()
    if (star === "*" && sp.length === 1) {
      const name = sp[0]
      return Object.keys(scripts).filter(k =>  k.startsWith(`${name}:`))
    }
    return n
  }))
}

// handled natively
function getRunScripts (cmd) {
  const re = new RegExp("(?:npm run" + RE_NAME + ")+", "gi")
  return unique(getMatches(re, cmd).map(m => m.match))
}

// handled by npm-run-all module
function getRunAllScripts (cmd) {
  const re = RegExp("(?:npm-run-all" + RE_FLAGS + RE_NAMES + ")+", "gi")
  const cmds = getMatches(re, cmd).map(m =>
    // clean spaces
    m.match.trim().split(" ").filter(x => x))

  return unique(flatten(cmds))
}

function getDetailedScripts (scripts) {
  return Object.keys(scripts).reduce((all, name) => {
    all[name] = {
      name: name,
      cmd: scripts[name],
      // booleans
      isPre: isLifeCycleScript(PRE, name, scripts),
      isPost: isLifeCycleScript(POST, name, scripts),
      // refs
      pre: scripts[PRE + name],
      post: scripts[POST + name],
      // strings
      subNames: getSubNames(name, scripts)
    }
    return all
  }, {})
}

function attachLabelAndNodes (scripts) {
  return Object.keys(scripts).reduce((all, name) => {
    const s = scripts[name]
    s.label = getLabel(s)
    s.nodes = s.subNames.map(n => scripts[n])

    if (s.pre) s.nodes.unshift(scripts[PRE + name])
    if (s.post) s.nodes.push(scripts[POST + name])

    all[name] = s
    return all
  }, {})
}

// only keep non lifeCycleScript from top level
function pruneLifeCycleScripts (scripts) {
  return Object.keys(scripts).reduce((all, name) => {
    const s = scripts[name]
    if (!s.isPre && !s.isPost) {
      all[name] = s
    }
    return all
  }, {})
}

function main (scripts, options) {
  if (!scripts) throw new Error("No package.json or no scripts key in this dir")

  let detailedScripts = getDetailedScripts(scripts)
  detailedScripts = attachLabelAndNodes(detailedScripts)
  if (options.p || options.prune) {
    detailedScripts = pruneLifeCycleScripts(detailedScripts)
  }

  // sort?
  const alpha = options.a || options.alpha
  return archy(archify(detailedScripts, alpha))
}

module.exports = {
  main,
  // test
  getRunScripts,
  getRunAllScripts,
  getSubNames,
  isLifeCycleScript
}
