// Em filesystems sem suporte a symlink (exFAT, alguns drives de rede no
// Windows), fs.readlink falha com EISDIR em arquivos comuns, quebrando o
// webpack e o file tracing do Next. Como nesses filesystems nao existem
// symlinks, a resposta semanticamente correta e EINVAL ("nao e symlink").
// O patch so e aplicado se o defeito for detectado.

const fs = require('fs');

function einval(p) {
  const err = new Error(`EINVAL: invalid argument, readlink '${p}'`);
  err.code = 'EINVAL';
  err.errno = -4071;
  err.syscall = 'readlink';
  err.path = String(p);
  return err;
}

let broken = false;
try {
  fs.readlinkSync(__filename);
} catch (err) {
  broken = err && err.code === 'EISDIR';
}

if (broken) {
  fs.readlinkSync = (p) => {
    throw einval(p);
  };
  fs.readlink = (p, options, callback) => {
    const cb = typeof options === 'function' ? options : callback;
    process.nextTick(() => cb(einval(p)));
  };
  fs.promises.readlink = async (p) => {
    throw einval(p);
  };
}
