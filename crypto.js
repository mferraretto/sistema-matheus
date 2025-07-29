exportar função assíncrona getKeyMaterial ( senha ) {
   
  const enc = novo TextEncoder ();
 
  retornar crypto.sutil.importKey (​​​
    'cru' ,
    enc. codificar (senha),
    { nome : 'PBKDF2' },
    falso ,
    [ 'deriveKey' ]
  );
}

exportar função assíncrona deriveKey ( senha, salt ) {
   
  const keyMaterial = await getKeyMaterial (senha);
 
  retornar cripto. sutil . deriveKey (
    {
      nome : 'PBKDF2' ,
      sal,
      iterações : 100000 ,
      hash : 'SHA-256'
    },
    Material-chave,
    { nome : 'AES-GCM' , comprimento : 256 },
    falso ,
    [ 'criptografar' , 'descriptografar' ]
  );
}

exportar função assíncrona encryptString ( str, senha ) {
   
  const enc = novo TextEncoder ();
 
  const iv = crypto.getRandomValues ( novo Uint8Array ( 12 ));
 
  const salt = crypto.getRandomValues ( novo Uint8Array ( 16 ) ) ;
 
  const key = await deriveKey (senha, salt);
 
  const ciphertext = await crypto. subtle . encrypt (
    { nome : 'AES-GCM' , iv},
    chave,
    enc. codificar (str)
  );
  const buffer = novo Uint8Array (texto cifrado);
 
  função toBase64 ( arr ) {
 
    retornar btoa ( String . fromCharCode (...arr));
 
  }
  retornar JSON . stringify ({
 
    : paraBase64 (c)
 ,
    sal : toBase64 (sal),
    dados : toBase64 (buffer)
  });
}

exportar função assíncrona decryptString ( jsonStr, senha ) {
   
  const enc = novo TextEncoder ();
 
  const obj = JSON . parse (jsonStr);
  função deBase64 ( b64 ) {
 
    retorne Uint8Array . de ( atob (b64), c => c.charCodeAt ( 0 ) ) ;
 
  }
  const iv = fromBase64 (obj. iv );
  const salt = fromBase64 (obj. salt );
  const dados = fromBase64 (obj. dados );
  const key = await deriveKey (senha, salt);
 
  const plaintext = await crypto. subtle . decrypt (
    { nome : 'AES-GCM' , iv},
    chave,
    dados
  );
  retornar novo TextDecoder (). decodificar (texto simples);
  
}
