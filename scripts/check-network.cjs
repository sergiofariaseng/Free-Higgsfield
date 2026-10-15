// No credentials or generation requests are used by this startup check.
fetch('https://api.higgsfield.ai/', {
  headers: { 'User-Agent': 'higgsfield-studio/1.0' },
  signal: AbortSignal.timeout(15000),
}).then(response => {
  if (response.status >= 500) throw new Error('HTTP ' + response.status);
  console.log('Conexao com o Higgsfield disponivel.');
}).catch(error => {
  console.error('Sem acesso ao Higgsfield (' + (error.cause?.code || error.name) + '). Execute Iniciar-app.cmd diretamente no Windows e confira a conexao/firewall.');
  process.exitCode = 1;
});
