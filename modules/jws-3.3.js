/*
 * jws.js - JSON Web Signature(JWS) and JSON Web Token(JWT) Class
 *
 * Original work Copyright (c) 2010-2018 Kenji Urushima (kenji.urushima@gmail.com)
 * Modified work Copyright (c) 2020 Sergei Sovik <sergeisovik@yahoo.com>
 *
 * This software is licensed under the terms of the MIT License.
 * https://kjur.github.io/jsrsasign/license/
 *
 * The above copyright and license notice shall be 
 * included in all copies or substantial portions of the Software.
 */

"use strict";

import { hashHex, Mac, Signature } from "./crypto-1.1.js"
import { ECDSA } from "./ecdsa-modified-1.0.js"
import { KeyObject, getKey } from "./keyutil-1.0.js"
import { Dictionary, isDictionary } from "./../../../include/type.js"
import { RSAKeyEx } from "./rsaex.js"
import { b64utohex, b64utoutf8, utf8tob64u, hextob64u, rstrtohex, zulutosec } from "./base64x-1.1.js"
import { parseBigInt } from "./../../js-bn/modules/rsa.js"

/**
 * JSON Web Signature/Token(JWS/JWT) module
 * <p>
 * This module privides following JWS/JWS related.
 * <ul>
 * <li>JSON Web Signature/Token(JWS/JWT) class</li>
 * <li>JWS JSON Serialization(JWSJS) class</li>
 * <li>UNIX origin time utility class</li>
 * </ul>
 * NOTE: Please ignore method summary and document of this namespace. This caused by a bug of jsdoc2.
 * </p>
 */

/**
 * JSON Web Signature(JWS) class.<br/>
 * @see <a href="https://kjur.github.io/jsjws/">'jwjws'(JWS JavaScript Library) home page https://kjur.github.io/jsjws/</a>
 * @description
 * This class provides JSON Web Signature(JWS)/JSON Web Token(JWT) signing and validation.
 *
 * <h4>METHOD SUMMARY</h4>
 * Here is major methods.
 * <ul>
 * <li><b>SIGN</b><br/>
 * <li>{@link sign} - sign JWS</li>
 * </li>
 * <li><b>VERIFY</b><br/>
 * <li>{@link verify} - verify JWS signature</li>
 * <li>{@link verifyJWT} - verify properties of JWT token at specified time</li>
 * </li>
 * <li><b>UTILITY</b><br/>
 * <li>{@link getJWKthumbprint} - get RFC 7638 JWK thumbprint</li>
 * <li>{@link isSafeJSONString} - check whether safe JSON string or not</li>
 * <li>{@link readSafeJSONString} - read safe JSON string only</li>
 * </li>
 * </ul> 
 *
 * <h4>SUPPORTED SIGNATURE ALGORITHMS</h4>
 * Here is supported algorithm names for {@link sign} and
 * {@link verify} methods.
 * <table>
 * <tr><th>alg value</th><th>spec requirement</th><th>jsjws support</th></tr>
 * <tr><td>HS256</td><td>REQUIRED</td><td>SUPPORTED</td></tr>
 * <tr><td>HS384</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>HS512</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>RS256</td><td>RECOMMENDED</td><td>SUPPORTED</td></tr>
 * <tr><td>RS384</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>RS512</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>ES256</td><td>RECOMMENDED+</td><td>SUPPORTED</td></tr>
 * <tr><td>ES384</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>ES512</td><td>OPTIONAL</td><td>-</td></tr>
 * <tr><td>PS256</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>PS384</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>PS512</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>none</td><td>REQUIRED</td><td>SUPPORTED(signature generation only)</td></tr>
 * </table>
 * <dl>
 * <dt><b>NOTE1</b>
 * <dd>HS384 is supported since jsjws 3.0.2 with jsrsasign 4.1.4.
 * <dt><b>NOTE2</b>
 * <dd>Some deprecated methods have been removed since jws 3.3 of jsrsasign 4.10.0.
 * Removed methods are following:
 * <ul>
 * <li>JWS.verifyJWSByNE</li>
 * <li>JWS.verifyJWSByKey</li>
 * <li>JWS.generateJWSByNED</li>
 * <li>JWS.generateJWSByKey</li>
 * <li>JWS.generateJWSByP1PrvKey</li>
 * </ul>
 * </dl>
 * <b>EXAMPLE</b><br/>
 * @example
 * // JWS signing 
 * sJWS = sign(null, '{"alg":"HS256", "cty":"JWT"}', '{"age": 21}', {"utf8": "password"});
 * // JWS validation
 * isValid = verify('eyJjdHkiOiJKV1QiLCJhbGc...', {"utf8": "password"});
 * // JWT validation
 * isValid = verifyJWT('eyJh...', {"utf8": "password"}, {
 *   alg: ['HS256', 'HS384'],
 *   iss: ['http://foo.com']
 * });
 */
export class JWS {
	constructor() {
		/** @type {Dictionary} */ this.parsedJWS;
	}

    /**
     * parse JWS string and set public property 'parsedJWS' dictionary.<br/>
     * @param {string} sJWS JWS signature string to be parsed.
     * @throws if sJWS is not comma separated string such like "Header.Payload.Signature".
     * @throws if JWS Header is a malformed JSON string.
     */
	parseJWS(sJWS, sigValNotNeeded) {
		if ((this.parsedJWS !== undefined) &&
			(sigValNotNeeded || (this.parsedJWS['sigvalH'] !== undefined))) {
			return;
		}
		let matchResult = sJWS.match(/^([^.]+)\.([^.]+)\.([^.]+)$/);
		if (matchResult == null) {
			throw "JWS signature is not a form of 'Head.Payload.SigValue'.";
		}
		let b6Head = matchResult[1];
		let b6Payload = matchResult[2];
		let b6SigVal = matchResult[3];
		let sSI = b6Head + "." + b6Payload;
		this.parsedJWS = /** @type {Dictionary} */ ( {} );
		this.parsedJWS['headB64U'] = b6Head;
		this.parsedJWS['payloadB64U'] = b6Payload;
		this.parsedJWS['sigvalB64U'] = b6SigVal;
		this.parsedJWS['si'] = sSI;

		if (!sigValNotNeeded) {
			let hSigVal = b64utohex(b6SigVal);
			let biSigVal = parseBigInt(hSigVal, 16);
			this.parsedJWS['sigvalH'] = hSigVal;
			this.parsedJWS['sigvalBI'] = biSigVal;
		}

		let sHead = b64utoutf8(b6Head);
		let sPayload = b64utoutf8(b6Payload);
		this.parsedJWS['headS'] = sHead;
		this.parsedJWS['payloadS'] = sPayload;

		if (!isSafeJSONString(sHead, this.parsedJWS, 'headP'))
			throw "malformed JSON string for JWS Head: " + sHead;
	}
}

/**
 * generate JWS signature by specified key<br/>
 * @param {string | null} alg JWS algorithm name to sign and force set to sHead or null 
 * @param {string | Dictionary} spHeader string or object of JWS Header
 * @param {string} spPayload string or object of JWS Payload
 * @param {KeyObject | string} key string of private key or mac key object to sign
 * @param {string=} pass (OPTION)passcode to use encrypted asymmetric private key 
 * @return {string} JWS signature string
 * @description
 * This method supports following algorithms.
 * <table>
 * <tr><th>alg value</th><th>spec requirement</th><th>jsjws support</th></tr>
 * <tr><td>HS256</td><td>REQUIRED</td><td>SUPPORTED</td></tr>
 * <tr><td>HS384</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>HS512</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>RS256</td><td>RECOMMENDED</td><td>SUPPORTED</td></tr>
 * <tr><td>RS384</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>RS512</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>ES256</td><td>RECOMMENDED+</td><td>SUPPORTED</td></tr>
 * <tr><td>ES384</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>ES512</td><td>OPTIONAL</td><td>-</td></tr>
 * <tr><td>PS256</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>PS384</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>PS512</td><td>OPTIONAL</td><td>SUPPORTED</td></tr>
 * <tr><td>none</td><td>REQUIRED</td><td>SUPPORTED(signature generation only)</td></tr>
 * </table>
 * <dl>
 * <dt>NOTE1:
 * <dd>salt length of RSAPSS signature is the same as the hash algorithm length
 * because of <a href="http://www.ietf.org/mail-archive/web/jose/current/msg02901.html">IETF JOSE ML discussion</a>.
 * <dt>NOTE2:
 * <dd>To support HS384, patched version of CryptoJS is used.
 * <a href="https://code.google.com/p/crypto-js/issues/detail?id=84">See here for detail</a>.
 * <dt>NOTE3:
 * From jsrsasign 4.10.0 jws 3.3.0, Way to provide password
 * for HS* algorithm is changed. The 'key' attribute value is
 * passed to {@link Mac.setPassword} so please see
 * {@link Mac.setPassword} for detail.
 * As for backword compatibility, if key is a string, has even length and
 * 0..9, A-F or a-f characters, key string is treated as a hexadecimal
 * otherwise it is treated as a raw string.
 * <dd>
 * </dl>
 * <b>EXAMPLE</b><br/>
 * @example
 * // sign HS256 signature with password "aaa" implicitly handled as string
 * sJWS = sign(null, {alg: "HS256", cty: "JWT"}, {age: 21}, "aaa");
 * // sign HS256 signature with password "6161" implicitly handled as hex
 * sJWS = sign(null, {alg: "HS256", cty: "JWT"}, {age: 21}, "6161");
 * // sign HS256 signature with base64 password
 * sJWS = sign(null, {alg: "HS256"}, {age: 21}, {b64: "Mi/8..a="});
 * // sign RS256 signature with PKCS#8 PEM RSA private key
 * sJWS = sign(null, {alg: "RS256"}, {age: 21}, "-----BEGIN PRIVATE KEY...");
 * // sign RS256 signature with PKCS#8 PEM ECC private key with passcode
 * sJWS = sign(null, {alg: "ES256"}, {age: 21}, 
 *                          "-----BEGIN PRIVATE KEY...", "keypass");
 * // header and payload can be passed by both string and object
 * sJWS = sign(null, '{alg:"HS256",cty:"JWT"}', '{age:21}', "aaa");
 */
export function sign(alg, spHeader, spPayload, key, pass) {
	let sHeader, pHeader, sPayload;

	// 1. check signatureInput(Header, Payload) is string or object
	if (typeof spHeader != 'string' && typeof spHeader != 'object')
		throw "spHeader must be JSON string or object: " + spHeader;

	if (typeof spHeader == 'object') {
		pHeader = spHeader;
		sHeader = JSON.stringify(pHeader);
	}

	if (typeof spHeader == 'string') {
		sHeader = spHeader;
		if (!isSafeJSONString(sHeader))
			throw "JWS Head is not safe JSON string: " + sHeader;
		pHeader = readSafeJSONString(sHeader);

	}

	sPayload = spPayload;
	if (typeof spPayload == 'object') sPayload = JSON.stringify(spPayload);

	// 2. use alg if defined in sHeader
	if ((alg == '' || alg == null) &&
		pHeader['alg'] !== undefined) {
		alg = pHeader['alg'];
	}

	// 3. update sHeader to add alg if alg undefined
	if ((alg != '' && alg != null) &&
		pHeader['alg'] === undefined) {
		pHeader['alg'] = alg;
		sHeader = JSON.stringify(pHeader);
	}

	// 4. check explicit algorithm doesn't match with JWS header.
	if (alg !== pHeader['alg'])
		throw "alg and sHeader.alg doesn't match: " + alg + "!=" + pHeader['alg'];

	// 5. set signature algorithm like SHA1withRSA
	let sigAlg = null;
	if (jwsalg2sigalg[alg] === undefined) {
		throw "unsupported alg name: " + alg;
	} else {
		sigAlg = jwsalg2sigalg[alg];
	}

	if (sHeader === undefined) sHeader = '';

	let uHeader = utf8tob64u(sHeader);
	let uPayload = utf8tob64u(sPayload);
	let uSignatureInput = uHeader + "." + uPayload
	// 6. sign
	let hSig = "";
	if (sigAlg.substr(0, 4) == "Hmac") {
		if (key === undefined)
			throw "mac key shall be specified for HS* alg";
		//alert("sigAlg=" + sigAlg);
		let mac = new Mac(/** @type {Dictionary} */ ( { 'alg': sigAlg, 'prov': 'cryptojs', 'pass': key } ));
		mac.updateString(uSignatureInput);
		hSig = mac.doFinal();
	} else if (sigAlg.indexOf("withECDSA") != -1) {
		let sig = new Signature(/** @type {Dictionary} */ ( { 'alg': sigAlg } ));
		sig.init(key, pass);
		sig.updateString(uSignatureInput);
		let hASN1Sig = sig.sign();
		hSig = ECDSA.asn1SigToConcatSig(hASN1Sig);
	} else if (sigAlg != "none") {
		let sig = new Signature(/** @type {Dictionary} */ ( { 'alg': sigAlg } ));
		sig.init(key, pass);
		sig.updateString(uSignatureInput);
		hSig = sig.sign();
	}

	let uSig = hextob64u(hSig);
	return uSignatureInput + "." + uSig;
}

/**
 * verify JWS signature by specified key or certificate<br/>
 * @param {string} sJWS string of JWS signature to verify
 * @param {string | KeyObject | Dictionary} key string of public key, certificate or key object to verify
 * @param {Array<string>=} acceptAlgs array of algorithm name strings (OPTION)
 * @return {boolean} true if the signature is valid otherwise false including no signature case or without head and payload
 * @description
 * <p>
 * This method verifies a JSON Web Signature Compact Serialization string by the validation 
 * algorithm as described in 
 * <a href="http://self-issued.info/docs/draft-jones-json-web-signature-04.html#anchor5">
 * the section 5 of Internet Draft draft-jones-json-web-signature-04.</a>
 * </p>
 * <p>
 * Since 3.2.0 strict key checking has been provided against a JWS algorithm
 * in a JWS header.
 * <ul>
 * <li>In case 'alg' is 'HS*' in the JWS header,
 * 'key' shall be hexadecimal string for Hmac{256,384,512} shared secret key.
 * Otherwise it raise an error.</li>
 * <li>In case 'alg' is 'RS*' or 'PS*' in the JWS header,
 * 'key' shall be a RSAKeyEx object or a PEM string of
 * X.509 RSA public key certificate or PKCS#8 RSA public key.
 * Otherwise it raise an error.</li>
 * <li>In case 'alg' is 'ES*' in the JWS header,
 * 'key' shall be a ECDSA object or a PEM string of
 * X.509 ECC public key certificate or PKCS#8 ECC public key.
 * Otherwise it raise an error.</li>
 * <li>In case 'alg' is 'none' in the JWS header,
 * validation not supported after jsjws 3.1.0.</li>
 * </ul>
 * </p>
 * <p>
 * NOTE1: The argument 'acceptAlgs' is supported since 3.2.0.
 * Strongly recommended to provide acceptAlgs to mitigate
 * signature replacement attacks.<br/>
 * </p>
 * <p>
 * NOTE2: From jsrsasign 4.9.0 jws 3.2.5, Way to provide password
 * for HS* algorithm is changed. The 'key' attribute value is
 * passed to {@link Mac.setPassword} so please see
 * {@link Mac.setPassword} for detail.
 * As for backword compatibility, if key is a string, has even length and
 * 0..9, A-F or a-f characters, key string is treated as a hexadecimal
 * otherwise it is treated as a raw string.
 * </p>
 * @example
 * // 1) verify a RS256 JWS signature by a certificate string.
 * isValid = verify('eyJh...', '-----BEGIN...', ['RS256']);
 * 
 * // 2) verify a HS256 JWS signature by a certificate string.
 * isValid = verify('eyJh...', {hex: '6f62ad...'}, ['HS256']);
 * isValid = verify('eyJh...', {b64: 'Mi/ab8...a=='}, ['HS256']);
 * isValid = verify('eyJh...', {utf8: 'Secret秘密'}, ['HS256']);
 * isValid = verify('eyJh...', '6f62ad', ['HS256']); // implicit hex
 * isValid = verify('eyJh...', '6f62ada', ['HS256']); // implicit raw string
 *
 * // 3) verify a ES256 JWS signature by a ECDSA key object.
 * let pubkey = getKey('-----BEGIN CERT...');
 * let isValid = verify('eyJh...', pubkey);
 */
export function verify(sJWS, key, acceptAlgs) {
	let a = sJWS.split(".");
	if (a.length !== 3) return false;

	let uHeader = a[0];
	let uPayload = a[1];
	let uSignatureInput = uHeader + "." + uPayload;
	let hSig = b64utohex(a[2]);

	// 1. parse JWS header
	let pHeader = readSafeJSONString(b64utoutf8(a[0]));
	let alg = null;
	let algType = null; // HS|RS|PS|ES|no
	if (pHeader['alg'] === undefined) {
		throw "algorithm not specified in header";
	} else {
		alg = pHeader['alg'];
		algType = alg.substr(0, 2);
	}

	// 2. check whether alg is acceptable algorithms
	if (acceptAlgs != null &&
		Object.prototype.toString.call(acceptAlgs) === '[object Array]' &&
		acceptAlgs.length > 0) {
		let acceptAlgStr = ":" + acceptAlgs.join(":") + ":";
		if (acceptAlgStr.indexOf(":" + alg + ":") == -1) {
			throw "algorithm '" + alg + "' not accepted in the list";
		}
	}

	// 3. check whether key is a proper key for alg.
	if (alg != "none" && key === null) {
		throw "key shall be specified to verify.";
	}

	// 3.1. There is no key check for HS* because Mac will check it.
	//      since jsrsasign 5.0.0.

	// 3.2. convert key object if key is a public key or cert PEM string
	if (typeof key == "string" &&
		key.indexOf("-----BEGIN ") != -1) {
		key = getKey(key);
	}

	// 3.3. check whether key is RSAKeyEx obj if alg is RS* or PS*.
	if (algType == "RS" || algType == "PS") {
		if (!(key instanceof RSAKeyEx)) {
			throw "key shall be a RSAKeyEx obj for RS* and PS* algs";
		}
	}

	// 3.4. check whether key is ECDSA obj if alg is ES*.
	if (algType == "ES") {
		if (!(key instanceof ECDSA)) {
			throw "key shall be a ECDSA obj for ES* algs";
		}
	}

	// 3.5. check when alg is 'none'
	//if (alg == "none") {
	//}

	// 4. check whether alg is supported alg in jsjws.
	let sigAlg = null;
	if (jwsalg2sigalg[pHeader['alg']] === undefined) {
		throw "unsupported alg name: " + alg;
	} else {
		sigAlg = jwsalg2sigalg[alg];
	}

	// 5. verify
	if (sigAlg == "none") {
		throw "not supported";
	} else if (sigAlg.substr(0, 4) == "Hmac") {
		let hSig2 = null;
		if (key === undefined)
			throw "hexadecimal key shall be specified for HMAC";
		//try {
		let mac = new Mac(/** @type {Dictionary} */ ( { 'alg': sigAlg, 'pass': key } ));
		mac.updateString(uSignatureInput);
		hSig2 = mac.doFinal();
		//} catch(ex) {};
		return hSig == hSig2;
	} else if (sigAlg.indexOf("withECDSA") != -1) {
		let hASN1Sig = null;
		try {
			hASN1Sig = ECDSA.concatSigToASN1Sig(hSig);
		} catch (ex) {
			return false;
		}
		let sig = new Signature(/** @type {Dictionary} */ ( { 'alg': sigAlg } ));
		sig.init(key)
		sig.updateString(uSignatureInput);
		return sig.verify(hASN1Sig);
	} else {
		let sig = new Signature(/** @type {Dictionary} */ ( { 'alg': sigAlg } ));
		sig.init(key)
		sig.updateString(uSignatureInput);
		return sig.verify(hSig);
	}
}

/**
 * parse header and payload of JWS signature<br/>
 * @param {string} sJWS string of JWS signature to parse
 * @return {Dictionary} associative array of parsed header and payload. See below.
 * @throws if sJWS is malformed JWS signature
 * @description
 * This method parses JWS signature string. 
 * Resulted associative array has following properties:
 * <ul>
 * <li>headerObj - JSON object of header</li>
 * <li>payloadObj - JSON object of payload if payload is JSON string otherwise undefined</li>
 * <li>headerPP - pretty printed JSON header by stringify</li>
 * <li>payloadPP - pretty printed JSON payload by stringify if payload is JSON otherwise Base64URL decoded raw string of payload</li>
 * <li>sigHex - hexadecimal string of signature</li>
 * </ul>
 * @example
 * parse(sJWS) ->
 * { 
 *   headerObj: {"alg": "RS256", "typ": "JWS"},
 *   payloadObj: {"product": "orange", "quantity": 100},
 *   headerPP: 
 *   '{
 *     "alg": "RS256",
 *     "typ": "JWS"
 *   }',
 *   payloadPP: 
 *   '{
 *     "product": "orange",
 *     "quantity": 100
 *   }',
 *   sigHex: "91f3cd..." 
 * }
 */
export function parse(sJWS) {
	let a = sJWS.split(".");
	let result = /** @type {Dictionary} */ ( {} );
	let uHeader, uPayload, uSig;
	if (a.length != 2 && a.length != 3)
		throw "malformed sJWS: wrong number of '.' splitted elements";

	uHeader = a[0];
	uPayload = a[1];
	if (a.length == 3) uSig = a[2];

	result['headerObj'] = readSafeJSONString(b64utoutf8(uHeader));
	result['payloadObj'] = readSafeJSONString(b64utoutf8(uPayload));

	result['headerPP'] = JSON.stringify(result['headerObj'], null, "  ");
	if (result['payloadObj'] == null) {
		result['payloadPP'] = b64utoutf8(uPayload);
	} else {
		result['payloadPP'] = JSON.stringify(result['payloadObj'], null, "  ");
	}

	if (uSig !== undefined) {
		result['sigHex'] = b64utohex(uSig);
	}

	return result;
}

/**
 * @param {string} sJWT string of JSON Web Token(JWT) to verify
 * @param {string | KeyObject | Dictionary} key string of public key, certificate or key object to verify
 * @param {Dictionary=} acceptField associative array of acceptable fields (OPTION)
 * @return {boolean} true if the JWT token is valid otherwise false
 *
 * @description
 * This method verifies a
 * <a href="https://tools.ietf.org/html/rfc7519">RFC 7519</a> 
 * JSON Web Token(JWT).
 * It will verify following:
 * <ul>
 * <li>Header.alg
 * <ul>
 * <li>alg is specified in JWT header.</li>
 * <li>alg is included in acceptField.alg array. (MANDATORY)</li>
 * <li>alg is proper for key.</li>
 * </ul>
 * </li>
 * <li>Payload.iss (issuer) - Payload.iss is included in acceptField.iss array if specified. (OPTION)</li>
 * <li>Payload.sub (subject) - Payload.sub is included in acceptField.sub array if specified. (OPTION)</li>
 * <li>Payload.aud (audience) - Payload.aud is included in acceptField.aud array or 
 *     the same as value if specified. (OPTION)</li>
 * <li>Time validity
 * <ul>
 * <li>
 * If acceptField.verifyAt as number of UNIX origin time is specifed for validation time, 
 * this method will verify at the time for it, otherwise current time will be used to verify.
 * </li>
 * <li>
 * Clock of JWT generator or verifier can be fast or slow. If these clocks are
 * very different, JWT validation may fail. To avoid such case, 'jsrsasign' supports
 * 'acceptField.gracePeriod' parameter which specifies acceptable time difference
 * of those clocks in seconds. So if you want to accept slow or fast in 2 hours,
 * you can specify <code>acceptField.gracePeriod = 2 * 60 * 60;</code>.
 * "gracePeriod" is zero by default.
 * "gracePeriod" is supported since jsrsasign 5.0.12.
 * </li>
 * <li>Payload.exp (expire) - Validation time is smaller than Payload.exp + gracePeriod.</li>
 * <li>Payload.nbf (not before) - Validation time is greater than Payload.nbf - gracePeriod.</li>
 * <li>Payload.iat (issued at) - Validation time is greater than Payload.iat - gracePeriod.</li>
 * </ul>
 * </li>
 * <li>Payload.jti (JWT id) - Payload.jti is included in acceptField.jti if specified. (OPTION)</li>
 * <li>JWS signature of JWS is valid for specified key.</li>
 * </ul>
 *
 * <h4>acceptField parameters</h4>
 * Here is available acceptField argument parameters:
 * <ul>
 * <li>alg - array of acceptable signature algorithm names (ex. ["HS256", "HS384"])</li>
 * <li>iss - array of acceptable issuer names (ex. ['http://foo.com'])</li>
 * <li>sub - array of acceptable subject names (ex. ['mailto:john@foo.com'])</li>
 * <li>aud - array of acceptable audience name (ex. ['http://foo.com'])</li>
 * <li>jti - string of acceptable JWT ID (OPTION) (ex. 'id1234')</li>
 * <li>
 * verifyAt - time to verify 'nbf', 'iat' and 'exp' in UNIX seconds 
 * (OPTION) (ex. 1377663900).  
 * If this is not specified, current time of verifier will be used. 
 * </li>
 * <li>gracePeriod - acceptable time difference between signer and verifier
 * in seconds (ex. 3600). If this is not specified, zero will be used.</li>
 * </ul>
 *
 * @example
 * // simple validation for HS256
 * isValid = verifyJWT("eyJhbG...", "616161", {alg: ["HS256"]}),
 *
 * // full validation for RS or PS
 * pubkey = getKey('-----BEGIN CERT...');
 * isValid = verifyJWT('eyJh...', pubkey, {
 *   alg: ['RS256', 'RS512', 'PS256', 'PS512'],
 *   iss: ['http://foo.com'],
 *   sub: ['mailto:john@foo.com', 'mailto:alice@foo.com'],
 *   verifyAt: getIntDate('20150520235959Z'),
 *   aud: ['http://foo.com'], // aud: 'http://foo.com' is fine too.
 *   jti: 'id123456',
 *   gracePeriod: 1 * 60 * 60 // accept 1 hour slow or fast
 * });
 */
export function verifyJWT(sJWT, key, acceptField) {
	// 1. parse JWT
	let a = sJWT.split(".");
	let uHeader = a[0];
	let uPayload = a[1];
	let uSignatureInput = uHeader + "." + uPayload;
	let hSig = b64utohex(a[2]);

	// 2. parse JWS header
	let pHeader = readSafeJSONString(b64utoutf8(uHeader));

	// 3. parse JWS payload
	let pPayload = readSafeJSONString(b64utoutf8(uPayload));

	// 4. algorithm ('alg' in header) check
	if (pHeader['alg'] === undefined) return false;
	if (acceptField['alg'] === undefined)
		throw "acceptField.alg shall be specified";
	if (!inArray(pHeader['alg'], acceptField['alg'])) return false;

	// 5. issuer ('iss' in payload) check
	if (pPayload['iss'] !== undefined && typeof acceptField['iss'] === "object") {
		if (!inArray(pPayload['iss'], acceptField['iss'])) return false;
	}

	// 6. subject ('sub' in payload) check
	if (pPayload['sub'] !== undefined && typeof acceptField['sub'] === "object") {
		if (!inArray(pPayload['sub'], acceptField['sub'])) return false;
	}

	// 7. audience ('aud' in payload) check
	if (pPayload['aud'] !== undefined && typeof acceptField['aud'] === "object") {
		if (typeof pPayload['aud'] == "string") {
			if (!inArray(pPayload['aud'], acceptField['aud']))
				return false;
		} else if (typeof pPayload['aud'] == "object") {
			if (!includedArray(pPayload['aud'], acceptField['aud']))
				return false;
		}
	}

	// 8. time validity 
	//   (nbf - gracePeriod < now < exp + gracePeriod) && (iat - gracePeriod < now)
	let now = getNow();
	if (acceptField['verifyAt'] !== undefined && typeof acceptField['verifyAt'] === "number") {
		now = acceptField['verifyAt'];
	}
	if (acceptField['gracePeriod'] === undefined ||
		typeof acceptField['gracePeriod'] !== "number") {
		acceptField['gracePeriod'] = 0;
	}

	// 8.1 expired time 'exp' check
	if (pPayload['exp'] !== undefined && typeof pPayload['exp'] == "number") {
		if (pPayload['exp'] + acceptField['gracePeriod'] < now) return false;
	}

	// 8.2 not before time 'nbf' check
	if (pPayload['nbf'] !== undefined && typeof pPayload['nbf'] == "number") {
		if (now < pPayload['nbf'] - acceptField['gracePeriod']) return false;
	}

	// 8.3 issued at time 'iat' check
	if (pPayload['iat'] !== undefined && typeof pPayload['iat'] == "number") {
		if (now < pPayload['iat'] - acceptField['gracePeriod']) return false;
	}

	// 9 JWT id 'jti' check
	if (pPayload['jti'] !== undefined && acceptField['jti'] !== undefined) {
		if (pPayload['jti'] !== acceptField['jti']) return false;
	}

	// 10 JWS signature check
	if (!verify(sJWT, key, acceptField['alg'])) return false;

	// 11 passed all check
	return true;
}

/**
 * check whether array is included by another array
 * @param {Array<string>} a1 check whether set a1 is included by a2
 * @param {Array<string>} a2 check whether set a1 is included by a2
 * @return {boolean} check whether set a1 is included by a2
 * This method verifies whether an array is included by another array.
 * It doesn't care about item ordering in a array.
 * @example
 * includedArray(['b'], ['b', 'c', 'a']) => true
 * includedArray(['a', 'b'], ['b', 'c', 'a']) => true
 * includedArray(['a', 'b'], ['b', 'c']) => false
 */
function includedArray(a1, a2) {
	for (let i = 0; i < a1.length; i++) {
		if (!inArray(a1[i], a2)) return false;
	}
	return true;
}

/**
 * check whether item is included by array
 * @param {string} item check whether item is included by array
 * @param {Array<string>} a check whether item is included by array
 * @return {boolean} check whether item is included by array
 * This method verifies whether an item is included by an array.
 * It doesn't care about item ordering in an array.
 * @example
 * inArray('b', ['b', 'c', 'a']) => true
 * inArray('a', ['b', 'c', 'a']) => true
 * inArray('a', ['b', 'c']) => false
 */
function inArray(item, a) {
	return a.indexOf(item) !== -1;
}

/**
 * static associative array of general signature algorithm name from JWS algorithm name
 */
const jwsalg2sigalg = {
	"HS256": "HmacSHA256",
	"HS384": "HmacSHA384",
	"HS512": "HmacSHA512",
	"RS256": "SHA256withRSA",
	"RS384": "SHA384withRSA",
	"RS512": "SHA512withRSA",
	"ES256": "SHA256withECDSA",
	"ES384": "SHA384withECDSA",
	//"ES512":	"SHA512withECDSA", // unsupported because of jsrsasign's bug
	"PS256": "SHA256withRSAandMGF1",
	"PS384": "SHA384withRSAandMGF1",
	"PS512": "SHA512withRSAandMGF1",
	"none": "none",
};

// === utility static method ==================================================

/**
 * check whether a String "s" is a safe JSON string or not.<br/>
 * If a String "s" is a malformed JSON string or an other object type
 * this returns 0, otherwise this returns 1.
 * @param {string} s JSON string
 * @param {Dictionary=} h
 * @param {string=} p
 * @return {number} 1 or 0
 */
export function isSafeJSONString(s, h, p) {
	let o = null;
	try {
		o = JSON.parse(s);
		if (typeof o != "object") return 0;
		if (o.constructor === Array) return 0;
		if (h) h[p] = o;
		return 1;
	} catch (ex) {
		return 0;
	}
}

/**
 * read a String "s" as JSON object if it is safe.<br/>
 * If a String "s" is a malformed JSON string or not JSON string,
 * this returns null, otherwise returns JSON object.
 * @param {string} s JSON string
 * @return {Dictionary | null} JSON object or null
 */
export function readSafeJSONString(s) {
	let o = null;
	try {
		o = JSON.parse(s);
		if (!isDictionary(o)) return null;
		return /** @type {Dictionary} */ ( o );
	} catch (ex) {
		return null;
	}
}

/**
 * get Encoed Signature Value from JWS string.<br/>
 * @param {string} sJWS JWS signature string to be verified
 * @return {string} string of Encoded Signature Value 
 * @throws if sJWS is not comma separated string such like "Header.Payload.Signature".
 */
export function getEncodedSignatureValueFromJWS(sJWS) {
	let matchResult = sJWS.match(/^[^.]+\.[^.]+\.([^.]+)$/);
	if (matchResult == null) {
		throw "JWS signature is not a form of 'Head.Payload.SigValue'.";
	}
	return matchResult[1];
}

/**
 * get RFC 7638 JWK thumbprint from JWK object
 * @param {Dictionary} o JWK object to be calculated thumbprint
 * @return {string} Base64 URL encoded JWK thumbprint value
 * @description
 * This method calculates JWK thmubprint for specified JWK object
 * as described in 
 * <a href="https://tools.ietf.org/html/rfc7638">RFC 7638</a>.
 * It supports all type of "kty". (i.e. "RSA", "EC" and "oct"
 * (for symmetric key))
 * Working sample is 
 * <a href="https://kjur.github.io/jsrsasign/sample/tool_jwktp.html">here</a>.
 * @example
 * jwk = {"kty":"RSA", "n":"0vx...", "e":"AQAB", ...};
 * thumbprint = getJWKthumbprint(jwk);
 */
export function getJWKthumbprint(o) {
	if (o['kty'] !== "RSA" &&
		o['kty'] !== "EC" &&
		o['kty'] !== "oct")
		throw "unsupported algorithm for JWK Thumprint";

	// 1. get canonically ordered json string
	let s = '{';
	if (o['kty'] === "RSA") {
		if (typeof o['n'] != "string" || typeof o['e'] != "string")
			throw "wrong n and e value for RSA key";
		s += '"' + 'e' + '":"' + o['e'] + '",';
		s += '"' + 'kty' + '":"' + o['kty'] + '",';
		s += '"' + 'n' + '":"' + o['n'] + '"}';
	} else if (o['kty'] === "EC") {
		if (typeof o['crv'] != "string" ||
			typeof o['x'] != "string" ||
			typeof o['y'] != "string")
			throw "wrong crv, x and y value for EC key";
		s += '"' + 'crv' + '":"' + o['crv'] + '",';
		s += '"' + 'kty' + '":"' + o['kty'] + '",';
		s += '"' + 'x' + '":"' + o['x'] + '",';
		s += '"' + 'y' + '":"' + o['y'] + '"}';
	} else if (o['kty'] === "oct") {
		if (typeof o['k'] != "string")
			throw "wrong k value for oct(symmetric) key";
		s += '"' + 'kty' + '":"' + o['kty'] + '",';
		s += '"' + 'k' + '":"' + o['k'] + '"}';
	}
	//alert(s);

	// 2. get thumb print
	let hJWK = rstrtohex(s);
	let hash = hashHex(hJWK, "sha256");
	let hashB64U = hextob64u(hash);

	return hashB64U;
}

/**
 * get UNIX origin time from by string
 * @param {string} s string of time representation
 * @return {number} UNIX origin time in seconds for argument 's'
 * @throws "unsupported format: s" when malformed format
 * @description
 * This method will accept following representation of time.
 * <ul>
 * <li>now - current time</li>
 * <li>now + 1hour - after 1 hour from now</li>
 * <li>now + 1day - after 1 day from now</li>
 * <li>now + 1month - after 30 days from now</li>
 * <li>now + 1year - after 365 days from now</li>
 * <li>YYYYmmDDHHMMSSZ - UTC time (ex. 20130828235959Z)</li>
 * <li>number - UNIX origin time (seconds from 1970-01-01 00:00:00) (ex. 1377714748)</li>
 * </ul>
 */
export function getIntDate(s) {
	if (s == "now") {
		return getNow();
	} else if (s == "now + 1hour") {
		return getNow() + 60 * 60;
	} else if (s == "now + 1day") {
		return getNow() + 60 * 60 * 24;
	} else if (s == "now + 1month") {
		return getNow() + 60 * 60 * 24 * 30;
	} else if (s == "now + 1year") {
		return getNow() + 60 * 60 * 24 * 365;
	} else if (s.match(/Z$/)) {
		return getZulu(s);
	} else if (s.match(/^[0-9]+$/)) {
		return parseInt(s, 10);
	}
	throw "unsupported format: " + s;
}

/**
 * get UNIX origin time from Zulu time representation string
 * @param {string} s string of Zulu time representation (ex. 20151012125959Z)
 * @return {number} UNIX origin time in seconds for argument 's'
 * @throws "unsupported format: s" when malformed format
 * @description
 * This method provides UNIX origin time from Zulu time.
 * Following representations are supported:
 * <ul>
 * <li>YYYYMMDDHHmmSSZ - GeneralizedTime format</li>
 * <li>YYMMDDHHmmSSZ - UTCTime format. If YY is greater or equal to 
 * 50 then it represents 19YY otherwise 20YY.</li>
 * </ul>
 * @example
 * getZulu("20151012125959Z") => 1478...
 * getZulu("151012125959Z") => 1478...
 */
export function getZulu(s) {
	return zulutosec(s);
}

/**
 * get UNIX origin time of current time
 * @return {number} UNIX origin time for current time
 * @description
 * This method provides UNIX origin time for current time
 * @example
 * getNow() => 1478...
 */
export function getNow() {
	let d = ~~(new Date() / 1000);
	return d;
}

/**
 * get UTC time string from UNIX origin time value
 * @param {number} intDate UNIX origin time value (ex. 1478...)
 * @return {string} UTC time string
 * @description
 * This method provides UTC time string for UNIX origin time value.
 * @example
 * intDate2UTCString(1478...) => "2015 Oct ..."
 */
export function intDate2UTCString(intDate) {
	let d = new Date(intDate * 1000);
	return d.toUTCString();
}

/**
 * get UTC time string from UNIX origin time value
 * @param {number} intDate UNIX origin time value (ex. 1478...)
 * @return {string} Zulu time string
 * @description
 * This method provides Zulu time string for UNIX origin time value.
 * @example
 * intDate2UTCString(1478...) => "20151012...Z"
 */
export function intDate2Zulu(intDate) {
	let d = new Date(intDate * 1000),
		year = ("0000" + d.getUTCFullYear()).slice(-4),
		mon = ("00" + (d.getUTCMonth() + 1)).slice(-2),
		day = ("00" + d.getUTCDate()).slice(-2),
		hour = ("00" + d.getUTCHours()).slice(-2),
		min = ("00" + d.getUTCMinutes()).slice(-2),
		sec = ("00" + d.getUTCSeconds()).slice(-2);
	return year + mon + day + hour + min + sec + "Z";
}
