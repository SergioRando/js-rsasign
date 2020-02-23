/*
 * asn1x509.js - ASN.1 DER encoder classes for X.509 certificate
 *
 * Original work Copyright (c) 2013-2018 Kenji Urushima (kenji.urushima@gmail.com)
 * Modified work Copyright (c) 2020 Sergio Rando <sergio.rando@yahoo.com>
 *
 * This software is licensed under the terms of the MIT License.
 * https://kjur.github.io/jsrsasign/license
 *
 * The above copyright and license notice shall be
 * included in all copies or substantial portions of the Software.
 */

"use strict";

import { ASN1Object, DERNull, DERBoolean, DERInteger, DERAbstractString, DERBitString, DEROctetString, DERUTF8String, DERPrintableString, DERTeletexString, DERObjectIdentifier, DERIA5String, DERAbstractTime, DERUTCTime, DERGeneralizedTime, DERSequence, DERSet, DERTaggedObject, newObject } from "./asn1-1.0.js"
import { name2obj, atype2obj } from "./asn1oid.js"
import { KEYUSAGE_NAME, X509 } from "./x509-1.1.js"
import { hextob64nl, pemtohex } from "./base64x-1.1.js"

/**
 * ASN.1 module for X.509 certificate
 * <p>
 * <h4>FEATURES</h4>
 * <ul>
 * <li>easily issue any kind of certificate</li>
 * <li>APIs are very similar to BouncyCastle library ASN.1 classes. So easy to learn.</li>
 * </ul>
 * </p>
 * <h4>PROVIDED FUNCTIONAL</h4>
 * <ul>
 * <li>{@link Certificate}</li>
 * <li>{@link TBSCertificate}</li>
 * <li>{@link X500Extension}</li>
 * <li>{@link X500Name}</li>
 * <li>{@link RDN}</li>
 * <li>{@link AttributeTypeAndValue}</li>
 * <li>{@link SubjectPublicKeyInfo}</li>
 * <li>{@link AlgorithmIdentifier}</li>
 * <li>{@link GeneralName}</li>
 * <li>{@link GeneralNames}</li>
 * <li>{@link DistributionPointName}</li>
 * <li>{@link DistributionPoint}</li>
 * <li>{@link CRL}</li>
 * <li>{@link TBSCertList}</li>
 * <li>{@link CRLEntry}</li>
 * </ul>
 * <h4>SUPPORTED EXTENSIONS</h4>
 * <ul>
 * <li>{@link BasicConstraints}</li>
 * <li>{@link KeyUsage}</li>
 * <li>{@link CRLDistributionPoints}</li>
 * <li>{@link ExtKeyUsage}</li>
 * <li>{@link AuthorityKeyIdentifier}</li>
 * <li>{@link AuthorityInfoAccess}</li>
 * <li>{@link SubjectAltName}</li>
 * <li>{@link IssuerAltName}</li>
 * </ul>
 * NOTE1: Please ignore method summary and document of this namespace. This caused by a bug of jsdoc2.<br/>
 * NOTE2: SubjectAltName and IssuerAltName extension were supported since 
 * jsrsasign 6.2.3 asn1x509 1.0.19.<br/>
 */

/**
 * X.509 Certificate class to sign and generate hex encoded certificate
 * @param {Object} params dictionary of parameters (ex. {'tbscertobj': obj, 'prvkeyobj': key})
 * @description
 * <br/>
 * As for argument 'params' for constructor, you can specify one of
 * following properties:
 * <ul>
 * <li>tbscertobj - specify {@link TBSCertificate} object</li>
 * <li>prvkeyobj - specify {@link RSAKey}, {@link KJUR.crypto.ECDSA} or {@link KJUR.crypto.DSA} object for CA private key to sign the certificate</li>
 * </ul>
 * NOTE1: 'params' can be omitted.<br/>
 * NOTE2: DSA/ECDSA is also supported for CA signging key from asn1x509 1.0.6.
 * @example
 * let caKey = KEYUTIL.getKey(caKeyPEM); // CA's private key
 * let cert = new KJUR.asn1x509.Certificate({'tbscertobj': tbs, 'prvkeyobj': caKey});
 * cert.sign(); // issue certificate by CA's private key
 * let certPEM = cert.getPEMString();
 *
 * // Certificate  ::=  SEQUENCE  {
 * //     tbsCertificate       TBSCertificate,
 * //     signatureAlgorithm   AlgorithmIdentifier,
 * //     signature            BIT STRING  }
 */
export class Certificate extends ASN1Object {
	/**
	 * @param {Object=} params 
	 */
	constructor(params) {
		super();

		/** @type {???? | null} */ this.asn1TBSCert = null;
		/** @type {???? | null} */ this.asn1SignatureAlg = null;
		/** @type {DERBitString | null} */ this.asn1Sig = null;
		/** @type {string | null} */ this.hexSig = null;
		/** @type {???? | null} */ this.prvKey = null;

		if (params !== undefined) {
			if (params['tbscertobj'] !== undefined) {
				this.asn1TBSCert = params['tbscertobj'];
			}
			if (params['prvkeyobj'] !== undefined) {
				this.prvKey = params['prvkeyobj'];
			}
		}
	}

    /**
     * sign TBSCertificate and set signature value internally
     * @description
     * @example
     * let cert = new Certificate({tbscertobj: tbs, prvkeyobj: prvKey});
     * cert.sign();
     */
	sign() {
		this.asn1SignatureAlg = this.asn1TBSCert.asn1SignatureAlg;

		let sig = new KJUR.crypto.Signature({ alg: this.asn1SignatureAlg.nameAlg });
		sig.init(this.prvKey);
		sig.updateHex(this.asn1TBSCert.getEncodedHex());
		this.hexSig = sig.sign();

		this.asn1Sig = new DERBitString({ 'hex': '00' + this.hexSig });

		let seq = new DERSequence({ 'array': [this.asn1TBSCert, this.asn1SignatureAlg, this.asn1Sig] });
		this.hTLV = seq.getEncodedHex();
		this.isModified = false;
	}

    /**
     * set signature value internally by hex string
     * @description
     * @example
     * let cert = new Certificate({'tbscertobj': tbs});
     * cert.setSignatureHex('01020304');
     */
	setSignatureHex(sigHex) {
		this.asn1SignatureAlg = this.asn1TBSCert.asn1SignatureAlg;
		this.hexSig = sigHex;
		this.asn1Sig = new DERBitString({ 'hex': '00' + this.hexSig });

		let seq = new DERSequence({
			'array': [this.asn1TBSCert,
			this.asn1SignatureAlg,
			this.asn1Sig]
		});
		this.hTLV = seq.getEncodedHex();
		this.isModified = false;
	}

	/**
	 * @override
	 * @returns {string}
	 */
	getEncodedHex() {
		if (this.isModified == false && this.hTLV != null) return this.hTLV;
		throw "not signed yet";
	}

    /**
     * get PEM formatted certificate string after signed
     * @return PEM formatted string of certificate
     * @description
     * @example
     * let cert = new Certificate({'tbscertobj': tbs, 'prvkeyobj': prvKey});
     * cert.sign();
     * let sPEM = cert.getPEMString();
     */
	getPEMString() {
		let pemBody = hextob64nl(this.getEncodedHex());
		return "-----BEGIN CERTIFICATE-----\r\n" +
			pemBody +
			"\r\n-----END CERTIFICATE-----\r\n";
	}
}

/**
 * ASN.1 TBSCertificate structure class
 * @param {Object} params dictionary of parameters (ex. {})
 * @description
 * <br/>
 * <h4>EXAMPLE</h4>
 * @example
 *  let o = new TBSCertificate();
 *  o.setSerialNumberByParam({'int': 4});
 *  o.setSignatureAlgByParam({'name': 'SHA1withRSA'});
 *  o.setIssuerByParam({'str': '/C=US/O=a'});
 *  o.setNotBeforeByParam({'str': '130504235959Z'});
 *  o.setNotAfterByParam({'str': '140504235959Z'});
 *  o.setSubjectByParam({'str': '/C=US/CN=b'});
 *  o.setSubjectPublicKey(rsaPubKey);
 *  o.appendExtension(new BasicConstraints({'cA':true}));
 *  o.appendExtension(new KeyUsage({'bin':'11'}));
 */
export class TBSCertificate extends ASN1Object {
	/**
	 * @param {Object=} params 
	 */
	constructor(params) {
		super();

		/** @type {Array<ASN1Object>} */ this.asn1Array = new Array();

		/** @type {DERTaggetObject} */ this.asn1Version = new DERTaggedObject({ 'obj': new DERInteger({ 'int': 2 }) });
		/** @type {DERInteger | null} */ this.asn1SerialNumber = null;
		/** @type {AlgorithmIdentifier | null} */ this.asn1SignatureAlg = null;
		/** @type {X500Name | null} */ this.asn1Issuer = null;
		/** @type {Time | null} */ this.asn1NotBefore = null;
		/** @type {Time | null} */ this.asn1NotAfter = null;
		/** @type {X500Name | null} */ this.asn1Subject = null;
		/** @type {SubjectPublicKeyInfo | null} */ this.asn1SubjPKey = null;
		/** @type {Array<X500Extension>} */ this.extensionsArray = new Array();
	}

    /**
     * set serial number field by parameter
     * @param {Object | number} intParam DERInteger param
     * @description
     * @example
     * tbsc.setSerialNumberByParam({'int': 3});
     */
	setSerialNumberByParam(intParam) {
		this.asn1SerialNumber = new DERInteger(intParam);
	}

    /**
     * set signature algorithm field by parameter
     * @param {Object} algIdParam AlgorithmIdentifier parameter
     * @description
     * @example
     * tbsc.setSignatureAlgByParam({'name': 'SHA1withRSA'});
     */
	setSignatureAlgByParam(algIdParam) {
		this.asn1SignatureAlg = new AlgorithmIdentifier(algIdParam);
	}

    /**
     * set issuer name field by parameter
     * @param {Object} x500NameParam X500Name parameter
     * @description
     * @example
     * tbsc.setIssuerParam({'str': '/C=US/CN=b'});
     */
	setIssuerByParam(x500NameParam) {
		this.asn1Issuer = new X500Name(x500NameParam);
	}

    /**
     * set notBefore field by parameter
     * @param {Object} timeParam Time parameter
     * @description
     * @example
     * tbsc.setNotBeforeByParam({'str': '130508235959Z'});
     */
	setNotBeforeByParam(timeParam) {
		this.asn1NotBefore = new Time(timeParam);
	}

    /**
     * set notAfter field by parameter
     * @param {Object} timeParam Time parameter
     * @description
     * @example
     * tbsc.setNotAfterByParam({'str': '130508235959Z'});
     */
	setNotAfterByParam(timeParam) {
		this.asn1NotAfter = new Time(timeParam);
	}

    /**
     * set subject name field by parameter
     * @param {Object} x500NameParam X500Name parameter
     * @description
     * @example
     * tbsc.setSubjectParam({'str': '/C=US/CN=b'});
     */
	setSubjectByParam(x500NameParam) {
		this.asn1Subject = new X500Name(x500NameParam);
	}

    /**
     * set subject public key info field by key object
     * @param {Object} param {@link SubjectPublicKeyInfo} class constructor parameter
     * @description
     * @example
     * tbsc.setSubjectPublicKey(keyobj);
     */
	setSubjectPublicKey(param) {
		this.asn1SubjPKey = new SubjectPublicKeyInfo(param);
	}

    /**
     * set subject public key info by RSA/ECDSA/DSA key parameter
     * @param {Object} keyParam public key parameter which passed to {@link KEYUTIL.getKey} argument
     * @description
     * @example
     * tbsc.setSubjectPublicKeyByGetKeyParam(certPEMString); // or
     * tbsc.setSubjectPublicKeyByGetKeyParam(pkcs8PublicKeyPEMString); // or
     * tbsc.setSubjectPublicKeyByGetKeyParam(kjurCryptoECDSAKeyObject); // et.al.
     */
	setSubjectPublicKeyByGetKey(keyParam) {
		let keyObj = KEYUTIL.getKey(keyParam);
		this.asn1SubjPKey = new SubjectPublicKeyInfo(keyObj);
	}

    /**
     * append X.509v3 extension to this object
     * @param {X500Extension} extObj X.509v3 Extension object
     * @description
     * @example
     * tbsc.appendExtension(new BasicConstraints({'cA':true, 'critical': true}));
     * tbsc.appendExtension(new KeyUsage({'bin':'11'}));
     */
	appendExtension(extObj) {
		this.extensionsArray.push(extObj);
	}

    /**
     * append X.509v3 extension to this object by name and parameters
     * @param {name} name name of X.509v3 Extension object
     * @param {Object} extParams parameters as argument of Extension constructor.
     * @description
     * This method adds a X.509v3 extension specified by name 
     * and extParams to internal extension array of X.509v3 extension objects.
     * Here is supported names of extension:
     * <ul>
     * <li>BasicConstraints - {@link BasicConstraints}</li>
     * <li>KeyUsage - {@link KeyUsage}</li>
     * <li>CRLDistributionPoints - {@link CRLDistributionPoints}</li>
     * <li>ExtKeyUsage - {@link ExtKeyUsage}</li>
     * <li>AuthorityKeyIdentifier - {@link AuthorityKeyIdentifier}</li>
     * <li>AuthorityInfoAccess - {@link AuthorityInfoAccess}</li>
     * <li>SubjectAltName - {@link SubjectAltName}</li>
     * <li>IssuerAltName - {@link IssuerAltName}</li>
     * </ul>
     * @example
     * let o = new TBSCertificate();
     * o.appendExtensionByName('BasicConstraints', {'cA':true, 'critical': true});
     * o.appendExtensionByName('KeyUsage', {'bin':'11'});
     * o.appendExtensionByName('CRLDistributionPoints', {uri: 'http://aaa.com/a.crl'});
     * o.appendExtensionByName('ExtKeyUsage', {array: [{name: 'clientAuth'}]});
     * o.appendExtensionByName('AuthorityKeyIdentifier', {kid: '1234ab..'});
     * o.appendExtensionByName('AuthorityInfoAccess', {array: [{accessMethod:{oid:...},accessLocation:{uri:...}}]});
     */
	appendExtensionByName(name, extParams) {
		X500Extension.appendByNameToArray(name,
			extParams,
			this.extensionsArray);
	}

	/**
	 * @override
	 * @returns {string}
	 */
	getEncodedHex() {
		if (this.asn1NotBefore == null || this.asn1NotAfter == null)
			throw "notBefore and/or notAfter not set";
		let asn1Validity =
			new DERSequence({ 'array': [this.asn1NotBefore, this.asn1NotAfter] });

		this.asn1Array = new Array();

		this.asn1Array.push(this.asn1Version);
		this.asn1Array.push(this.asn1SerialNumber);
		this.asn1Array.push(this.asn1SignatureAlg);
		this.asn1Array.push(this.asn1Issuer);
		this.asn1Array.push(asn1Validity);
		this.asn1Array.push(this.asn1Subject);
		this.asn1Array.push(this.asn1SubjPKey);

		if (this.extensionsArray.length > 0) {
			let extSeq = new DERSequence({ "array": this.extensionsArray });
			let extTagObj = new DERTaggedObject({
				'explicit': true,
				'tag': 'a3',
				'obj': extSeq
			});
			this.asn1Array.push(extTagObj);
		}

		let o = new DERSequence({ "array": this.asn1Array });
		this.hTLV = o.getEncodedHex();
		this.isModified = false;
		return this.hTLV;
	}
}

/**
 * base Extension ASN.1 structure class
 * @abstract
 * @param {Object} params dictionary of parameters (ex. {'critical': true})
 * @description
 * @example
 * // Extension  ::=  SEQUENCE  {
 * //     extnID      OBJECT IDENTIFIER,
 * //     critical    BOOLEAN DEFAULT FALSE,
 * //     extnValue   OCTET STRING  }
 */
export class X500Extension extends ASN1Object {
	/**
	 * @param {Object=} params 
	 */
	constructor(params) {
		super();

		/** @type {ASN1Object | null} */ this.asn1ExtnValue = null;

		this.critical = false;
		if (params !== undefined) {
			if (params['critical'] !== undefined) {
				this.critical = params['critical'] ? true : false;
			}
		}
	}

	/**
	 * @override
	 * @returns {string}
	 */
	getEncodedHex() {
		let asn1Oid = new DERObjectIdentifier({ 'oid': this.oid });
		let asn1EncapExtnValue = new DEROctetString({ 'hex': this.getExtnValueHex() });

		/** @type {Array<ASN1Object> */ let asn1Array = new Array();
		asn1Array.push(asn1Oid);
		if (this.critical) asn1Array.push(new DERBoolean());
		asn1Array.push(asn1EncapExtnValue);

		let asn1Seq = new DERSequence({ 'array': asn1Array });
		return asn1Seq.getEncodedHex();
	}

	/**
	 * append X.509v3 extension to any specified array<br/>
	 * @param {string} name X.509v3 extension name
	 * @param {Object} extParams associative array of extension parameters
	 * @param {Array<ASN1Object>} a array to add specified extension
	 * @description
	 * This static function add a X.509v3 extension specified by name and extParams to
	 * array 'a' so that 'a' will be an array of X.509v3 extension objects.
	 * See {@link TBSCertificate#appendExtensionByName}
	 * for supported names of extensions.
	 * @example
	 * let a = new Array();
	 * X500Extension.appendByNameToArray("BasicConstraints", {'cA':true, 'critical': true}, a);
	 * X500Extension.appendByNameToArray("KeyUsage", {'bin':'11'}, a);
	 */
	static appendByNameToArray(name, extParams, a) {
		let lowname = name.toLowerCase(),

		if (lowname == "basicconstraints") {
			let extObj = new BasicConstraints(extParams);
			a.push(extObj);
		} else if (lowname == "keyusage") {
			let extObj = new KeyUsage(extParams);
			a.push(extObj);
		} else if (lowname == "crldistributionpoints") {
			let extObj = new CRLDistributionPoints(extParams);
			a.push(extObj);
		} else if (lowname == "extkeyusage") {
			let extObj = new ExtKeyUsage(extParams);
			a.push(extObj);
		} else if (lowname == "authoritykeyidentifier") {
			let extObj = new AuthorityKeyIdentifier(extParams);
			a.push(extObj);
		} else if (lowname == "authorityinfoaccess") {
			let extObj = new AuthorityInfoAccess(extParams);
			a.push(extObj);
		} else if (lowname == "subjectaltname") {
			let extObj = new SubjectAltName(extParams);
			a.push(extObj);
		} else if (lowname == "issueraltname") {
			let extObj = new IssuerAltName(extParams);
			a.push(extObj);
		} else {
			throw "unsupported extension name: " + name;
		}
	}

	/**
	 * @abstract
	 * @returns {string}
	 */
	getExtnValueHex() {}
}

/**
 * KeyUsage ASN.1 structure class
 * @param {Object} params dictionary of parameters (ex. {'bin': '11', 'critical': true})
 * @description
 * This class is for <a href="https://tools.ietf.org/html/rfc5280#section-4.2.1.3" target="_blank">KeyUsage</a> X.509v3 extension.
 * <pre>
 * id-ce-keyUsage OBJECT IDENTIFIER ::=  { id-ce 15 }
 * KeyUsage ::= BIT STRING {
 *   digitalSignature   (0),
 *   nonRepudiation     (1),
 *   keyEncipherment    (2),
 *   dataEncipherment   (3),
 *   keyAgreement       (4),
 *   keyCertSign        (5),
 *   cRLSign            (6),
 *   encipherOnly       (7),
 *   decipherOnly       (8) }
 * </pre><br/>
 * NOTE: 'names' parameter is supprted since jsrsasign 8.0.14.
 * @example
 * o = new KeyUsage({'bin': "11"});
 * o = new KeyUsage({'critical': true, 'bin': "11"});
 * o = new KeyUsage({'names': ['digitalSignature', 'keyAgreement']});
 */
export class KeyUsage extends X500Extension {
	/**
	 * @param {Object=} params 
	 */
	constructor(params) {
		super(params);

		this.oid = "2.5.29.15";
		/** @type {DERBitString | null} */ this.asn1ExtnValue;

		if (params !== undefined) {
			if (params['bin'] !== undefined) {
				this.asn1ExtnValue = new DERBitString(params);
			}
			if (params['names'] !== undefined && params['names'].length !== undefined) {
				let names = params['names'];
				let s = "000000000";
				for (let i = 0; i < names.length; i++) {
					for (let j = 0; j < KEYUSAGE_NAME.length; j++) {
						if (names[i] === KEYUSAGE_NAME[j]) {
							s = s.substring(0, j) + '1' +
								s.substring(j + 1, s.length);
						}
					}
				}
				this.asn1ExtnValue = new DERBitString({ bin: s });
			}
		}
	}

	/**
	 * @returns {string}
	 */
	getExtnValueHex() {
		return this.asn1ExtnValue.getEncodedHex();
	}
}

/**
 * BasicConstraints ASN.1 structure class
 * @param {Object} params dictionary of parameters (ex. {'cA': true, 'critical': true})
 * @description
 * @example
 */
export class BasicConstraints extends X500Extension {
	/**
	 * @param {Object=} params 
	 */
	constructor(params) {
		super(params);

		/** @type {DERSequence | null} */ this.asn1ExtnValue;

		this.oid = "2.5.29.19";
		this.cA = false;
		this.pathLen = -1;

		if (params !== undefined) {
			if (params['cA'] !== undefined) {
				this.cA = params['cA'];
			}
			if (params['pathLen'] !== undefined) {
				this.pathLen = params['pathLen'];
			}
		}	
	}

	/**
	 * @returns {string}
	 */
	getExtnValueHex() {
		/** @type {Array<ASN1Object>} */ let asn1Array = new Array();
		if (this.cA) asn1Array.push(new DERBoolean());
		if (this.pathLen > -1)
			asn1Array.push(new DERInteger({ 'int': this.pathLen }));
		let asn1Seq = new DERSequence({ 'array': asn1Array });
		this.asn1ExtnValue = asn1Seq;
		return this.asn1ExtnValue.getEncodedHex();
	}
}

/**
 * CRLDistributionPoints ASN.1 structure class
 * @param {Object} params dictionary of parameters (ex. {'uri': 'http://a.com/', 'critical': true})
 * @description
 * <pre>
 * id-ce-cRLDistributionPoints OBJECT IDENTIFIER ::=  { id-ce 31 }
 *
 * CRLDistributionPoints ::= SEQUENCE SIZE (1..MAX) OF DistributionPoint
 *
 * DistributionPoint ::= SEQUENCE {
 *      distributionPoint       [0]     DistributionPointName OPTIONAL,
 *      reasons                 [1]     ReasonFlags OPTIONAL,
 *      cRLIssuer               [2]     GeneralNames OPTIONAL }
 *
 * DistributionPointName ::= CHOICE {
 *      fullName                [0]     GeneralNames,
 *      nameRelativeToCRLIssuer [1]     RelativeDistinguishedName }
 * 
 * ReasonFlags ::= BIT STRING {
 *      unused                  (0),
 *      keyCompromise           (1),
 *      cACompromise            (2),
 *      affiliationChanged      (3),
 *      superseded              (4),
 *      cessationOfOperation    (5),
 *      certificateHold         (6),
 *      privilegeWithdrawn      (7),
 *      aACompromise            (8) }
 * </pre>
 * @example
 */
export class CRLDistributionPoints extends X500Extension {
	/**
	 * @param {Object=} params 
	 */
	constructor(params) {
		super(params);

		this.oid = "2.5.29.31";
		if (params !== undefined) {
			if (params['array'] !== undefined) {
				this.setByDPArray(params['array']);
			} else if (params['uri'] !== undefined) {
				this.setByOneURI(params['uri']);
			}
		}
	}

	/**
	 * @returns {string}
	 */
	getExtnValueHex() {
		return this.asn1ExtnValue.getEncodedHex();
	}

	setByDPArray(dpArray) {
		this.asn1ExtnValue = new KJUR.asn1.DERSequence({ 'array': dpArray });
	}

	setByOneURI(uri) {
		let gn1 = new GeneralNames([{ 'uri': uri }]);
		let dpn1 = new DistributionPointName(gn1);
		let dp1 = new DistributionPoint({ 'dpobj': dpn1 });
		this.setByDPArray([dp1]);
	}
}

/**
 * KeyUsage ASN.1 structure class
 * @param {Object} params dictionary of parameters
 * @description
 * @example
 * e1 = new ExtKeyUsage({
 *   critical: true,
 *   array: [
 *     {oid: '2.5.29.37.0'},  // anyExtendedKeyUsage
 *     {name: 'clientAuth'}
 *   ]
 * });
 * // id-ce-extKeyUsage OBJECT IDENTIFIER ::= { id-ce 37 }
 * // ExtKeyUsageSyntax ::= SEQUENCE SIZE (1..MAX) OF KeyPurposeId
 * // KeyPurposeId ::= OBJECT IDENTIFIER
 */
export class ExtKeyUsage extends X500Extension {
	/**
	 * @param {Object=} params 
	 */
	constructor(params) {
		super(params);

		/** @type {DERSequence | null} */ this.asn1ExtnValue;

		this.oid = "2.5.29.37";
		if (params !== undefined) {
			if (params['array'] !== undefined) {
				this.setPurposeArray(params['array']);
			}
		}
	}

	/**
	 * @param {Array<Object>} purposeArray 
	 */
	setPurposeArray(purposeArray) {
		this.asn1ExtnValue = new DERSequence();
		for (let i = 0; i < purposeArray.length; i++) {
			let o = new DERObjectIdentifier(purposeArray[i]);
			this.asn1ExtnValue.appendASN1Object(o);
		}
	}

	/**
	 * @returns {string}
	 */
	getExtnValueHex() {
		return this.asn1ExtnValue.getEncodedHex();
	}
}

/**
 * AuthorityKeyIdentifier ASN.1 structure class
 * @param {Object} params dictionary of parameters (ex. {'uri': 'http://a.com/', 'critical': true})
 * @description
 * <pre>
 * d-ce-authorityKeyIdentifier OBJECT IDENTIFIER ::=  { id-ce 35 }
 * AuthorityKeyIdentifier ::= SEQUENCE {
 *    keyIdentifier             [0] KeyIdentifier           OPTIONAL,
 *    authorityCertIssuer       [1] GeneralNames            OPTIONAL,
 *    authorityCertSerialNumber [2] CertificateSerialNumber OPTIONAL  }
 * KeyIdentifier ::= OCTET STRING
 * </pre>
 * @example
 * e1 = new AuthorityKeyIdentifier({
 *   critical: true,
 *   kid:    {hex: '89ab'},
 *   issuer: {str: '/C=US/CN=a'},
 *   sn:     {hex: '1234'}
 * });
 */
export class AuthorityKeyIdentifier extends X500Extension {
	/**
	 * @param {Object=} params 
	 */
	constructor(params) {
		super(params);

		/** @type {DERSequence | null} */ this.asn1ExtnValue;

		/** @type {DEROctetString | null} */ this.asn1KID = null;
		/** @type {X500Name | null} */ this.asn1CertIssuer = null;
		/** @type {DERInteger | null} */ this.asn1CertSN = null;

		this.oid = "2.5.29.35";
		if (params !== undefined) {
			if (params['kid'] !== undefined) {
				this.setKIDByParam(params['kid']);
			}
			if (params['issuer'] !== undefined) {
				this.setCertIssuerByParam(params['issuer']);
			}
			if (params['sn'] !== undefined) {
				this.setCertSNByParam(params['sn']);
			}
		}	
	}

	/**
	 * @returns {string}
	 */
	getExtnValueHex() {
		/** @type {Array<ASN1Object>} */ let a = new Array();
		if (this.asn1KID)
			a.push(new DERTaggedObject({
				'explicit': false,
				'tag': '80',
				'obj': this.asn1KID
			}));
		if (this.asn1CertIssuer)
			a.push(new DERTaggedObject({
				'explicit': false,
				'tag': 'a1',
				'obj': this.asn1CertIssuer
			}));
		if (this.asn1CertSN)
			a.push(new DERTaggedObject({
				'explicit': false,
				'tag': '82',
				'obj': this.asn1CertSN
			}));

		let asn1Seq = new DERSequence({ 'array': a });
		this.asn1ExtnValue = asn1Seq;
		return this.asn1ExtnValue.getEncodedHex();
	}

    /**
     * set keyIdentifier value by DERInteger parameter
     * @param {Object} param array of {@link DERInteger} parameter
     * @description
     * NOTE: Automatic keyIdentifier value calculation by an issuer
     * public key will be supported in future version.
     */
	setKIDByParam(param) {
		this.asn1KID = new DEROctetString(param);
	}

    /**
     * set authorityCertIssuer value by X500Name parameter
     * @param {Object} param array of {@link X500Name} parameter
     * @description
     * NOTE: Automatic authorityCertIssuer name setting by an issuer
     * certificate will be supported in future version.
     */
	setCertIssuerByParam(param) {
		this.asn1CertIssuer = new X500Name(param);
	}

    /**
     * set authorityCertSerialNumber value by DERInteger parameter
     * @param {Object} param array of {@link DERInteger} parameter
     * @description
     * NOTE: Automatic authorityCertSerialNumber setting by an issuer
     * certificate will be supported in future version.
     */
	setCertSNByParam(param) {
		this.asn1CertSN = new DERInteger(param);
	}
}

/**
 * AuthorityInfoAccess ASN.1 structure class
 * @param {Object} params dictionary of parameters
 * @description
 * <pre>
 * id-pe OBJECT IDENTIFIER  ::=  { id-pkix 1 }
 * id-pe-authorityInfoAccess OBJECT IDENTIFIER ::= { id-pe 1 }
 * AuthorityInfoAccessSyntax  ::=
 *         SEQUENCE SIZE (1..MAX) OF AccessDescription
 * AccessDescription  ::=  SEQUENCE {
 *         accessMethod          OBJECT IDENTIFIER,
 *         accessLocation        GeneralName  }
 * id-ad OBJECT IDENTIFIER ::= { id-pkix 48 }
 * id-ad-caIssuers OBJECT IDENTIFIER ::= { id-ad 2 }
 * id-ad-ocsp OBJECT IDENTIFIER ::= { id-ad 1 }
 * </pre>
 * @example
 * e1 = new AuthorityInfoAccess({
 *   'array': [{
 *     'accessMethod': {'oid': '1.3.6.1.5.5.7.48.1'},
 *     'accessLocation': {'uri': 'http://ocsp.cacert.org'}
 *   }]
 * });
 */
export class AuthorityInfoAccess extends X500Extension {
	/**
	 * @param {Object=} params 
	 */
	constructor(params) {
		super(params);

		/** @type {DERSequence | null} */ this.asn1ExtnValue;

		this.oid = "1.3.6.1.5.5.7.1.1";		
		if (params !== undefined) {
			if (params['array'] !== undefined) {
				this.setAccessDescriptionArray(params['array']);
			}
		}
	}
	
	/**
	 * @param {Array<Object>} accessDescriptionArray 
	 */
	setAccessDescriptionArray(accessDescriptionArray) {
		/** @type {Array<DERSequence>} */ let array = new Array();

		for (let i = 0; i < accessDescriptionArray.length; i++) {
			let o = new DERObjectIdentifier(accessDescriptionArray[i]['accessMethod']);
			let gn = new GeneralName(accessDescriptionArray[i]['accessLocation']);
			let accessDescription = new DERSequence({ 'array': [o, gn] });
			array.push(accessDescription);
		}
		this.asn1ExtnValue = new DERSequence({ 'array': array });
	}

	/**
	 * @returns {string}
	 */
	getExtnValueHex() {
		return this.asn1ExtnValue.getEncodedHex();
	}
}

/**
 * SubjectAltName ASN.1 structure class<br/>
 * @param {Object} params dictionary of parameters
 * @description
 * This class provides X.509v3 SubjectAltName extension.
 * <pre>
 * id-ce-subjectAltName OBJECT IDENTIFIER ::=  { id-ce 17 }
 * SubjectAltName ::= GeneralNames
 * GeneralNames ::= SEQUENCE SIZE (1..MAX) OF GeneralName
 * GeneralName ::= CHOICE {
 *   otherName                  [0] OtherName,
 *   rfc822Name                 [1] IA5String,
 *   dNSName                    [2] IA5String,
 *   x400Address                [3] ORAddress,
 *   directoryName              [4] Name,
 *   ediPartyName               [5] EDIPartyName,
 *   uniformResourceIdentifier  [6] IA5String,
 *   iPAddress                  [7] OCTET STRING,
 *   registeredID               [8] OBJECT IDENTIFIER }
 * </pre>
 * @example
 * e1 = new SubjectAltName({
 *   'critical': true,
 *   'array': [{'uri': 'http://aaa.com/'}, {'uri': 'http://bbb.com/'}]
 * });
 */
export class SubjectAltName extends X500Extension {
	/**
	 * @param {Object=} params 
	 */
	constructor(params) {
		super(params);

		/** @type {GeneralNames | null} */ this.asn1ExtnValue;

		this.oid = "2.5.29.17";
		if (params !== undefined) {
			if (params['array'] !== undefined) {
				this.setNameArray(params['array']);
			}
		}	
	}

	/**
	 * @param {Array<Object>} paramsArray 
	 */
	setNameArray(paramsArray) {
		this.asn1ExtnValue = new GeneralNames(paramsArray);
	}

	/**
	 * @returns {string}
	 */
	getExtnValueHex() {
		return this.asn1ExtnValue.getEncodedHex();
	}
}

/**
 * IssuerAltName ASN.1 structure class<br/>
 * @param {Object} params dictionary of parameters
 * @description
 * This class provides X.509v3 IssuerAltName extension.
 * <pre>
 * id-ce-subjectAltName OBJECT IDENTIFIER ::=  { id-ce 18 }
 * IssuerAltName ::= GeneralNames
 * GeneralNames ::= SEQUENCE SIZE (1..MAX) OF GeneralName
 * GeneralName ::= CHOICE {
 *   otherName                  [0] OtherName,
 *   rfc822Name                 [1] IA5String,
 *   dNSName                    [2] IA5String,
 *   x400Address                [3] ORAddress,
 *   directoryName              [4] Name,
 *   ediPartyName               [5] EDIPartyName,
 *   uniformResourceIdentifier  [6] IA5String,
 *   iPAddress                  [7] OCTET STRING,
 *   registeredID               [8] OBJECT IDENTIFIER }
 * </pre>
 * @example
 * e1 = new IssuerAltName({
 *   critical: true,
 *   array: [{uri: 'http://aaa.com/'}, {uri: 'http://bbb.com/'}]
 * });
 */
export class IssuerAltName extends X500Extension {
	/**
	 * @param {Object=} params 
	 */
	constructor(params) {
		super(params);

		/** @type {GeneralNames | null} */ this.asn1ExtnValue;

		this.oid = "2.5.29.18";
		if (params !== undefined) {
			if (params['array'] !== undefined) {
				this.setNameArray(params['array']);
			}
		}
	}
		
	/**
	 * @param {Array<Object>} paramsArray 
	 */
	setNameArray(paramsArray) {
		this.asn1ExtnValue = new GeneralNames(paramsArray);
	}

	/**
	 * @returns {string}
	 */
	getExtnValueHex() {
		return this.asn1ExtnValue.getEncodedHex();
	}
}

/**
 * X.509 CRL class to sign and generate hex encoded CRL
 * @param {Object} params dictionary of parameters (ex. {'tbsobj': obj, 'rsaprvkey': key})
 * @description
 * <br/>
 * As for argument 'params' for constructor, you can specify one of
 * following properties:
 * <ul>
 * <li>tbsobj - specify {@link TBSCertList} object to be signed</li>
 * <li>rsaprvkey - specify {@link RSAKey} object CA private key</li>
 * </ul>
 * NOTE: 'params' can be omitted.
 * <h4>EXAMPLE</h4>
 * @example
 * let prvKey = new RSAKey(); // CA's private key
 * prvKey.readPrivateKeyFromASN1HexString("3080...");
 * let crl = new KJUR.asn1x509.CRL({'tbsobj': tbs, 'prvkeyobj': prvKey});
 * crl.sign(); // issue CRL by CA's private key
 * let hCRL = crl.getEncodedHex();
 *
 * // CertificateList  ::=  SEQUENCE  {
 * //     tbsCertList          TBSCertList,
 * //     signatureAlgorithm   AlgorithmIdentifier,
 * //     signatureValue       BIT STRING  }
 */
export class CRL extends ASN1Object {
	/**
	 * @param {Object=} params 
	 */
	constructor(params) {
		super();

		this.asn1TBSCertList = null,
		this.asn1SignatureAlg = null,
		/** @type {DERBitString | null} */ this.asn1Sig = null,
		/** @type {string | null} */ this.hexSig = null,
		this.prvKey = null;

		if (params !== undefined) {
			if (params['tbsobj'] !== undefined) {
				this.asn1TBSCertList = params['tbsobj'];
			}
			if (params['prvkeyobj'] !== undefined) {
				this.prvKey = params['prvkeyobj'];
			}
		}
	}

    /**
     * sign TBSCertList and set signature value internally
     * @description
     * @example
     * let cert = new CRL({'tbsobj': tbs, 'prvkeyobj': prvKey});
     * cert.sign();
     */
	sign() {
		this.asn1SignatureAlg = this.asn1TBSCertList.asn1SignatureAlg;

		sig = new KJUR.crypto.Signature({ 'alg': 'SHA1withRSA', 'prov': 'cryptojs/jsrsa' });
		sig.init(this.prvKey);
		sig.updateHex(this.asn1TBSCertList.getEncodedHex());
		this.hexSig = sig.sign();

		this.asn1Sig = new DERBitString({ 'hex': '00' + this.hexSig });

		let seq = new DERSequence({
			'array': [this.asn1TBSCertList,
			this.asn1SignatureAlg,
			this.asn1Sig]
		});
		this.hTLV = seq.getEncodedHex();
		this.isModified = false;
	}

	/**
	 * @override
	 * @returns {string}
	 */
	getEncodedHex() {
		if (this.isModified == false && this.hTLV != null) return this.hTLV;
		throw "not signed yet";
	}

    /**
     * get PEM formatted CRL string after signed
     * @return {string} PEM formatted string of certificate
     * @description
     * @example
     * let cert = new CRL({'tbsobj': tbs, 'rsaprvkey': prvKey});
     * cert.sign();
     * let sPEM =  cert.getPEMString();
     */
	getPEMString() {
		let pemBody = hextob64nl(this.getEncodedHex());
		return "-----BEGIN X509 CRL-----\r\n" +
			pemBody +
			"\r\n-----END X509 CRL-----\r\n";
	}
}

/**
 * ASN.1 TBSCertList structure class for CRL
 * @param {Object} params dictionary of parameters (ex. {})
 * @description
 * <br/>
 * <h4>EXAMPLE</h4>
 * @example
 *  let o = new TBSCertList();
 *  o.setSignatureAlgByParam({'name': 'SHA1withRSA'});
 *  o.setIssuerByParam({'str': '/C=US/O=a'});
 *  o.setNotThisUpdateByParam({'str': '130504235959Z'});
 *  o.setNotNextUpdateByParam({'str': '140504235959Z'});
 *  o.addRevokedCert({'int': 4}, {'str':'130514235959Z'}));
 *  o.addRevokedCert({'hex': '0f34dd'}, {'str':'130514235959Z'}));
 *
 * // TBSCertList  ::=  SEQUENCE  {
 * //        version                 Version OPTIONAL,
 * //                                     -- if present, MUST be v2
 * //        signature               AlgorithmIdentifier,
 * //        issuer                  Name,
 * //        thisUpdate              Time,
 * //        nextUpdate              Time OPTIONAL,
 * //        revokedCertificates     SEQUENCE OF SEQUENCE  {
 * //             userCertificate         CertificateSerialNumber,
 * //             revocationDate          Time,
 * //             crlEntryExtensions      Extensions OPTIONAL
 * //                                      -- if present, version MUST be v2
 * //                                  }  OPTIONAL,
 * //        crlExtensions           [0]  EXPLICIT Extensions OPTIONAL
 */
export class TBSCertList extends ASN1Object {
	/**
	 * @param {Object=} params 
	 */
	constructor(params) {
		super();

		/** @type {Array<ASN1Object>} */ this.asn1Array;
		/** @type {DERTaggetObject | null} */ this.asn1Version = null;
		/** @type {AlgorithmIdentifier | null} */ this.asn1SignatureAlg = null;
		/** @type {X500Name | null} */ this.asn1Issuer = null;
		/** @type {Time | null} */ this.asn1ThisUpdate = null;
		/** @type {Time | null} */ this.asn1NextUpdate = null;
		/** @type {Array<CRLEntry>} */ this.aRevokedCert = new Array();
	}

    /**
     * set signature algorithm field by parameter
     * @param {Object} algIdParam AlgorithmIdentifier parameter
     * @description
     * @example
     * tbsc.setSignatureAlgByParam({'name': 'SHA1withRSA'});
     */
	setSignatureAlgByParam(algIdParam) {
		this.asn1SignatureAlg =	new AlgorithmIdentifier(algIdParam);
	}

    /**
     * set issuer name field by parameter
     * @param {Object} x500NameParam X500Name parameter
     * @description
     * @example
     * tbsc.setIssuerParam({'str': '/C=US/CN=b'});
     */
	setIssuerByParam(x500NameParam) {
		this.asn1Issuer = new X500Name(x500NameParam);
	}

    /**
     * set thisUpdate field by parameter
     * @param {Object} timeParam Time parameter
     * @description
     * @example
     * tbsc.setThisUpdateByParam({'str': '130508235959Z'});
     */
	setThisUpdateByParam(timeParam) {
		this.asn1ThisUpdate = new Time(timeParam);
	}

    /**
     * set nextUpdate field by parameter
     * @param {Object} timeParam Time parameter
     * @description
     * @example
     * tbsc.setNextUpdateByParam({'str': '130508235959Z'});
     */
	setNextUpdateByParam(timeParam) {
		this.asn1NextUpdate = new Time(timeParam);
	}

    /**
     * add revoked certificate by parameter
     * @param {Object} snParam DERInteger parameter for certificate serial number
     * @param {Object} timeParam Time parameter for revocation date
     * @description
     * @example
     * tbsc.addRevokedCert({'int': 3}, {'str': '130508235959Z'});
     */
	addRevokedCert(snParam, timeParam) {
		let param = {};
		if (snParam != undefined && snParam != null)
			param['sn'] = snParam;
		if (timeParam != undefined && timeParam != null)
			param['time'] = timeParam;
		let o = new CRLEntry(param);
		this.aRevokedCert.push(o);
	}

	/**
	 * @override
	 * @returns {string}
	 */
	getEncodedHex() {
		this.asn1Array = new Array();

		if (this.asn1Version != null) this.asn1Array.push(this.asn1Version);
		this.asn1Array.push(this.asn1SignatureAlg);
		this.asn1Array.push(this.asn1Issuer);
		this.asn1Array.push(this.asn1ThisUpdate);
		if (this.asn1NextUpdate != null) this.asn1Array.push(this.asn1NextUpdate);

		if (this.aRevokedCert.length > 0) {
			let seq = new DERSequence({ 'array': this.aRevokedCert });
			this.asn1Array.push(seq);
		}

		let o = new DERSequence({ "array": this.asn1Array });
		this.hTLV = o.getEncodedHex();
		this.isModified = false;
		return this.hTLV;
	}
}

/**
 * ASN.1 CRLEntry structure class for CRL
 * @param {Object} params dictionary of parameters (ex. {})
 * @description
 * @example
 * let e = new CRLEntry({'time': {'str': '130514235959Z'}, 'sn': {'int': 234}});
 *
 * // revokedCertificates     SEQUENCE OF SEQUENCE  {
 * //     userCertificate         CertificateSerialNumber,
 * //     revocationDate          Time,
 * //     crlEntryExtensions      Extensions OPTIONAL
 * //                             -- if present, version MUST be v2 }
 */
export class CRLEntry extends ASN1Object {
	/**
	 * @param {Object=} params 
	 */
	constructor(params) {
		super(params);

		/** @type {DERInteger | null} */ this.sn = null;
		/** @type {Time | null} */ this.time = null;

		if (params !== undefined) {
			if (params['time'] !== undefined) {
				this.setRevocationDate(params['time']);
			}
			if (params['sn'] !== undefined) {
				this.setCertSerial(params['sn']);
			}
		}
	}

    /**
     * set DERInteger parameter for serial number of revoked certificate
     * @param {Object} intParam DERInteger parameter for certificate serial number
     * @description
     * @example
     * entry.setCertSerial({'int': 3});
     */
	setCertSerial(intParam) {
		this.sn = new DERInteger(intParam);
	}

    /**
     * set Time parameter for revocation date
     * @param {Object} timeParam Time parameter for revocation date
     * @description
     * @example
     * entry.setRevocationDate({'str': '130508235959Z'});
     */
	setRevocationDate(timeParam) {
		this.time = new Time(timeParam);
	}

	/**
	 * @override
	 * @returns {string}
	 */
	getEncodedHex() {
		let o = new DERSequence({ "array": [this.sn, this.time] });
		this.TLV = o.getEncodedHex();
		return this.TLV;
	}
}

/**
 * X500Name ASN.1 structure class
 * @param {Object} params dictionary of parameters (ex. {'str': '/C=US/O=a'})
 * @description
 * This class provides DistinguishedName ASN.1 class structure
 * defined in <a href="https://tools.ietf.org/html/rfc2253#section-2">RFC 2253 section 2</a>.
 * <blockquote><pre>
 * DistinguishedName ::= RDNSequence
 *
 * RDNSequence ::= SEQUENCE OF RelativeDistinguishedName
 *
 * RelativeDistinguishedName ::= SET SIZE (1..MAX) OF
 *   AttributeTypeAndValue
 *
 * AttributeTypeAndValue ::= SEQUENCE {
 *   type  AttributeType,
 *   value AttributeValue }
 * </pre></blockquote>
 * <br/>
 * For string representation of distinguished name in jsrsasign,
 * OpenSSL oneline format is used. Please see <a href="https://github.com/kjur/jsrsasign/wiki/NOTE-distinguished-name-representation-in-jsrsasign">wiki article</a> for it.
 * <br/>
 * NOTE: Multi-valued RDN is supported since jsrsasign 6.2.1 asn1x509 1.0.17.
 * @example
 * // 1. construct with string
 * o = new X500Name({str: "/C=US/O=aaa/OU=bbb/CN=foo@example.com"});
 * o = new X500Name({str: "/C=US/O=aaa+CN=contact@example.com"}); // multi valued
 * // 2. construct by object
 * o = new X500Name({C: "US", O: "aaa", CN: "http://example.com/"});
 */
export class X500Name extends ASN1Object {
	/**
	 * @param {Object=} params 
	 */
	constructor(params) {
		super();

		/** @type {Array<RDN>} */ this.asn1Array = new Array();

		if (params !== undefined) {
			if (params['str'] !== undefined) {
				this.setByString(params['str']);
			} else if (params['ldapstr'] !== undefined) {
				this.setByLdapString(params['ldapstr']);
				// If params is an object, then set the ASN1 array just using the object
				// attributes. This is nice for fields that have lots of special
				// characters (i.e. CN: 'https://www.github.com/kjur//').
			} else if (typeof params === "object") {
				this.setByObject(params);
			}
	
			if (params['certissuer'] !== undefined) {
				let x = new X509();
				x.hex = pemtohex(params['certissuer']);
				this.hTLV = x.getIssuerHex();
			}
			if (params['certsubject'] !== undefined) {
				let x = new X509();
				x.hex = pemtohex(params['certsubject']);
				this.hTLV = x.getSubjectHex();
			}
		}
	}

    /**
     * set DN by OpenSSL oneline distinguished name string<br/>
     * @param {string} dnStr distinguished name by string (ex. /C=US/O=aaa)
     * @description
     * Sets distinguished name by string. 
     * dnStr must be formatted as 
     * "/type0=value0/type1=value1/type2=value2...".
     * No need to escape a slash in an attribute value.
     * @example
     * name = new X500Name();
     * name.setByString("/C=US/O=aaa/OU=bbb/CN=foo@example.com");
     * // no need to escape slash in an attribute value
     * name.setByString("/C=US/O=aaa/CN=1980/12/31");
     */
	setByString(dnStr) {
		let a = dnStr.split('/');
		a.shift();

		let a1 = [];
		for (let i = 0; i < a.length; i++) {
			if (a[i].match(/^[^=]+=.+$/)) {
				a1.push(a[i]);
			} else {
				let lastidx = a1.length - 1;
				a1[lastidx] = a1[lastidx] + "/" + a[i];
			}
		}

		for (let i = 0; i < a1.length; i++) {
			this.asn1Array.push(new RDN({ 'str': a1[i] }));
		}
	}

    /**
     * set DN by LDAP(RFC 2253) distinguished name string<br/>
     * @param {string} dnStr distinguished name by LDAP string (ex. O=aaa,C=US)
     * @description
     * @example
     * name = new X500Name();
     * name.setByLdapString("CN=foo@example.com,OU=bbb,O=aaa,C=US");
     */
	setByLdapString(dnStr) {
		let oneline = X500Name.ldapToOneline(dnStr);
		this.setByString(oneline);
	}

    /**
     * set DN by associative array<br/>
     * @param {Object} dnObj associative array of DN (ex. {C: "US", O: "aaa"})
     * @description
     * @example
     * name = new X500Name();
     * name.setByObject({C: "US", O: "aaa", CN="http://example.com/"1});
     */
	setByObject(dnObj) {
		// Get all the dnObject attributes and stuff them in the ASN.1 array.
		for (let x in dnObj) {
			if (dnObj.hasOwnProperty(x)) {
				let newRDN = new RDN(
					{ 'str': x + '=' + dnObj[x] });
				// Initialize or push into the ANS1 array.
				this.asn1Array ? this.asn1Array.push(newRDN)
					: this.asn1Array = [newRDN];
			}
		}
	}

	/**
	 * @override
	 * @returns {string}
	 */
	getEncodedHex() {
		if (typeof this.hTLV == "string") return this.hTLV;
		let o = new DERSequence({ "array": this.asn1Array });
		this.hTLV = o.getEncodedHex();
		return this.hTLV;
	}

	/**
	 * convert OpenSSL oneline distinguished name format string to LDAP(RFC 2253) format<br/>
	 * @param {string} s distinguished name string in OpenSSL oneline format (ex. /C=US/O=test)
	 * @return {string} distinguished name string in LDAP(RFC 2253) format (ex. O=test,C=US)
	 * @description
	 * This static method converts a distinguished name string in OpenSSL oneline 
	 * format to LDAP(RFC 2253) format.
	 * @example
	 * X500Name.onelineToLDAP("/C=US/O=test") &rarr; 'O=test,C=US'
	 * X500Name.onelineToLDAP("/C=US/O=a,a") &rarr; 'O=a\,a,C=US'
	 */
	static onelineToLDAP(s) {
		if (s.substr(0, 1) !== "/") throw "malformed input";

		s = s.substr(1);

		let a = s.split("/");
		a.reverse();
		a = a.map(function (s) { return s.replace(/,/, "\\,") });

		return a.join(",");
	}

	/**
	 * convert LDAP(RFC 2253) distinguished name format string to OpenSSL oneline format<br/>
	 * @param {string} s distinguished name string in LDAP(RFC 2253) format (ex. O=test,C=US)
	 * @return {string} distinguished name string in OpenSSL oneline format (ex. /C=US/O=test)
	 * @description
	 * This static method converts a distinguished name string in 
	 * LDAP(RFC 2253) format to OpenSSL oneline format.
	 * @example
	 * X500Name.ldapToOneline('O=test,C=US') &rarr; '/C=US/O=test'
	 * X500Name.ldapToOneline('O=a\,a,C=US') &rarr; '/C=US/O=a,a'
	 * X500Name.ldapToOneline('O=a/a,C=US')  &rarr; '/C=US/O=a\/a'
	 */
	static ldapToOneline(s) {
		let a = s.split(",");

		// join \,
		let isBSbefore = false;
		let a2 = [];
		for (let i = 0; a.length > 0; i++) {
			let item = a.shift();
			//console.log("item=" + item);

			if (isBSbefore === true) {
				let a2last = a2.pop();
				let newitem = (a2last + "," + item).replace(/\\,/g, ",");
				a2.push(newitem);
				isBSbefore = false;
			} else {
				a2.push(item);
			}

			if (item.substr(-1, 1) === "\\") isBSbefore = true;
		}

		a2 = a2.map(function (s) { return s.replace("/", "\\/") });
		a2.reverse();
		return "/" + a2.join("/");
	}
}

/**
 * RDN (Relative Distinguished Name) ASN.1 structure class
 * @param {Object} params dictionary of parameters (ex. {'str': 'C=US'})
 * @description
 * This class provides RelativeDistinguishedName ASN.1 class structure
 * defined in <a href="https://tools.ietf.org/html/rfc2253#section-2">RFC 2253 section 2</a>.
 * <blockquote><pre>
 * RelativeDistinguishedName ::= SET SIZE (1..MAX) OF
 *   AttributeTypeAndValue
 *
 * AttributeTypeAndValue ::= SEQUENCE {
 *   type  AttributeType,
 *   value AttributeValue }
 * </pre></blockquote>
 * <br/>
 * NOTE: Multi-valued RDN is supported since jsrsasign 6.2.1 asn1x509 1.0.17.
 * @example
 * rdn = new RDN({str: "CN=test"});
 * rdn = new RDN({str: "O=a+O=bb+O=c"}); // multi-valued
 * rdn = new RDN({str: "O=a+O=b\\+b+O=c"}); // plus escaped
 * rdn = new RDN({str: "O=a+O=\"b+b\"+O=c"}); // double quoted
 */
export class RDN extends ASN1Object {
	/**
	 * @param {Object=} params 
	 */
	constructor(params) {
		super();

		/** @type {Array<AttributeTypeAndValue>} */ this.asn1Array = new Array();

		if (params !== undefined) {
			if (params['str'] !== undefined) {
				this.addByMultiValuedString(params['str']);
			}
		}
	}

    /**
     * add one AttributeTypeAndValue by string<br/>
     * @param {string} s string of AttributeTypeAndValue
     * @return {Object} unspecified
     * @description
     * This method add one AttributeTypeAndValue to RDN object.
     * @example
     * rdn = new RDN();
     * rdn.addByString("CN=john");
     * rdn.addByString("serialNumber=1234"); // for multi-valued RDN
     */
	addByString(s) {
		this.asn1Array.push(new AttributeTypeAndValue({ 'str': s }));
	}

    /**
     * add one AttributeTypeAndValue by multi-valued string<br/>
     * @param {string} s string of multi-valued RDN
     * @return {Object} unspecified
     * @description
     * This method add multi-valued RDN to RDN object.
     * @example
     * rdn = new RDN();
     * rdn.addByMultiValuedString("CN=john+O=test");
     * rdn.addByMultiValuedString("O=a+O=b\+b\+b+O=c"); // multi-valued RDN with quoted plus
     * rdn.addByMultiValuedString("O=a+O=\"b+b+b\"+O=c"); // multi-valued RDN with quoted quotation
     */
	addByMultiValuedString(s) {
		let a = RDN.parseString(s);
		for (let i = 0; i < a.length; i++) {
			this.addByString(a[i]);
		}
	}

	/**
	 * @override
	 * @returns {string}
	 */
	getEncodedHex() {
		let o = new DERSet({ "array": this.asn1Array });
		this.TLV = o.getEncodedHex();
		return this.TLV;
	}

	/**
	 * parse multi-valued RDN string and split into array of 'AttributeTypeAndValue'<br/>
	 * @param {string} s multi-valued string of RDN
	 * @return {Array<string>} array of string of AttributeTypeAndValue
	 * @description
	 * This static method parses multi-valued RDN string and split into
	 * array of AttributeTypeAndValue.
	 * @example
	 * RDN.parseString("CN=john") &rarr; ["CN=john"]
	 * RDN.parseString("CN=john+OU=test") &rarr; ["CN=john", "OU=test"]
	 * RDN.parseString('CN="jo+hn"+OU=test') &rarr; ["CN=jo+hn", "OU=test"]
	 * RDN.parseString('CN=jo\+hn+OU=test') &rarr; ["CN=jo+hn", "OU=test"]
	 * RDN.parseString("CN=john+OU=test+OU=t1") &rarr; ["CN=john", "OU=test", "OU=t1"]
	 */
	static parseString(s) {
		let a = s.split(/\+/);

		// join \+
		let isBSbefore = false;
		/** @type {Array<string>} */ let a2 = [];
		for (let i = 0; a.length > 0; i++) {
			let item = a.shift();
			//console.log("item=" + item);

			if (isBSbefore === true) {
				let a2last = a2.pop();
				let newitem = (a2last + "+" + item).replace(/\\\+/g, "+");
				a2.push(newitem);
				isBSbefore = false;
			} else {
				a2.push(item);
			}

			if (item.substr(-1, 1) === "\\") isBSbefore = true;
		}

		// join quote
		let beginQuote = false;
		/** @type {Array<string>} */ let a3 = [];
		for (let i = 0; a2.length > 0; i++) {
			let item = a2.shift();

			if (beginQuote === true) {
				let a3last = a3.pop();
				if (item.match(/"$/)) {
					let newitem = (a3last + "+" + item).replace(/^([^=]+)="(.*)"$/, "$1=$2");
					a3.push(newitem);
					beginQuote = false;
				} else {
					a3.push(a3last + "+" + item);
				}
			} else {
				a3.push(item);
			}

			if (item.match(/^[^=]+="/)) {
				//console.log(i + "=" + item);
				beginQuote = true;
			}
		}

		return a3;
	}
}

/**
 * AttributeTypeAndValue ASN.1 structure class
 * @param {Object} params dictionary of parameters (ex. {'str': 'C=US'})
 * @description
 * @example
 */
export class AttributeTypeAndValue extends ASN1Object {
	/**
	 * @param {Object=} params 
	 */
	constructor(params) {
		super();

		/** @type {DERObjectIdentifier | null} */ this.typeObj = null,
		/** @type {DERAbstractString | null} */ this.valueObj = null,
		this.defaultDSType = "utf8";

		if (params !== undefined) {
			if (params['str'] !== undefined) {
				this.setByString(params['str']);
			}
		}	
	}

	/**
	 * @param {string} attrTypeAndValueStr 
	 */
	setByString(attrTypeAndValueStr) {
		let matchResult = attrTypeAndValueStr.match(/^([^=]+)=(.+)$/);
		if (matchResult) {
			this.setByAttrTypeAndValueStr(matchResult[1], matchResult[2]);
		} else {
			throw "malformed attrTypeAndValueStr: " + attrTypeAndValueStr;
		}
	}

	/**
	 * @param {string} shortAttrType 
	 * @param {string} valueStr 
	 */
	setByAttrTypeAndValueStr(shortAttrType, valueStr) {
		this.typeObj = atype2obj(shortAttrType);
		let dsType = defaultDSType;
		if (shortAttrType == "C") dsType = "prn";
		this.valueObj = this.getValueObj(dsType, valueStr);
	}

	/**
	 * @param {string} dsType 
	 * @param {string} valueStr 
	 * @returns {DERAbstractString}
	 * @throws
	 */
	getValueObj(dsType, valueStr) {
		if (dsType == "utf8") return new DERUTF8String({ "str": valueStr });
		if (dsType == "prn") return new DERPrintableString({ "str": valueStr });
		if (dsType == "tel") return new DERTeletexString({ "str": valueStr });
		if (dsType == "ia5") return new DERIA5String({ "str": valueStr });
		throw "unsupported directory string type: type=" + dsType + " value=" + valueStr;
	}

	/**
	 * @override
	 * @returns {string}
	 */
	getEncodedHex() {
		let o = new KJUR.asn1.DERSequence({ "array": [this.typeObj, this.valueObj] });
		this.TLV = o.getEncodedHex();
		return this.TLV;
	}
}

/**
 * SubjectPublicKeyInfo ASN.1 structure class
 * @param {Object} params parameter for subject public key
 * @description
 * <br/>
 * As for argument 'params' for constructor, you can specify one of
 * following properties:
 * <ul>
 * <li>{@link RSAKey} object</li>
 * <li>{@link KJUR.crypto.ECDSA} object</li>
 * <li>{@link KJUR.crypto.DSA} object</li>
 * </ul>
 * NOTE1: 'params' can be omitted.<br/>
 * NOTE2: DSA/ECDSA key object is also supported since asn1x509 1.0.6.<br/>
 * <h4>EXAMPLE</h4>
 * @example
 * spki = new SubjectPublicKeyInfo(RSAKey_object);
 * spki = new SubjectPublicKeyInfo(KJURcryptoECDSA_object);
 * spki = new SubjectPublicKeyInfo(KJURcryptoDSA_object);
 */
export class SubjectPublicKeyInfo extends ASN1Object {
	/**
	 * @param {Object=} params 
	 */
	constructor(params) {
		super();

		/** @type {AlgorithmIdentifier | null} */ this.asn1AlgId = null;
		/** @type {DERBitString | null} */ this.asn1SubjPKey = null;

		if (params !== undefined) {
			this.setPubKey(params);
		}
	}

    /*
     */
	getASN1Object() {
		if (this.asn1AlgId == null || this.asn1SubjPKey == null)
			throw "algId and/or subjPubKey not set";
		let o = new DERSequence({
			'array':
				[this.asn1AlgId, this.asn1SubjPKey]
		});
		return o;
	}

	/**
	 * @override
	 * @returns {string}
	 */
	getEncodedHex() {
		let o = this.getASN1Object();
		this.hTLV = o.getEncodedHex();
		return this.hTLV;
	}

    /**
     * @param {Object} {@link RSAKey}, {@link KJUR.crypto.ECDSA} or {@link KJUR.crypto.DSA} object
     * @description
     * @example
     * spki = new SubjectPublicKeyInfo();
     * pubKey = KEYUTIL.getKey(PKCS8PUBKEYPEM);
     * spki.setPubKey(pubKey);
     */
	setPubKey(key) {
		try {
			if (key instanceof RSAKey) {
				let asn1RsaPub = newObject({
					'seq': [{ 'int': { 'bigint': key.n } }, { 'int': { 'int': key.e } }]
				});
				let rsaKeyHex = asn1RsaPub.getEncodedHex();
				this.asn1AlgId = new AlgorithmIdentifier({ 'name': 'rsaEncryption' });
				this.asn1SubjPKey = new DERBitString({ 'hex': '00' + rsaKeyHex });
			}
		} catch (ex) { };

		try {
			if (key instanceof KJUR.crypto.ECDSA) {
				let asn1Params = new DERObjectIdentifier({ 'name': key.curveName });
				this.asn1AlgId =
					new AlgorithmIdentifier({
						'name': 'ecPublicKey',
						'asn1params': asn1Params
					});
				this.asn1SubjPKey = new DERBitString({ 'hex': '00' + key.pubKeyHex });
			}
		} catch (ex) { };

		try {
			if (key instanceof KJUR.crypto.DSA) {
				let asn1Params = new newObject({
					'seq': [{ 'int': { 'bigint': key.p } },
					{ 'int': { 'bigint': key.q } },
					{ 'int': { 'bigint': key.g } }]
				});
				this.asn1AlgId =
					new AlgorithmIdentifier({
						'name': 'dsa',
						'asn1params': asn1Params
					});
				let pubInt = new DERInteger({ 'bigint': key.y });
				this.asn1SubjPKey =
					new DERBitString({ 'hex': '00' + pubInt.getEncodedHex() });
			}
		} catch (ex) { };
	}
}

/**
 * Time ASN.1 structure class
 * @param {Object} params dictionary of parameters (ex. {'str': '130508235959Z'})
 * @description
 * <br/>
 * <h4>EXAMPLES</h4>
 * @example
 * let t1 = new Time{'str': '130508235959Z'} // UTCTime by default
 * let t2 = new Time{'type': 'gen',  'str': '20130508235959Z'} // GeneralizedTime
 */
export class Time extends ASN1Object {
	/**
	 * @param {Object=} params 
	 */
	constructor(params) {
		super();

		/** @type {string | null} */ this.type = null;
		/** @type {Object | null} */ this.timeParams = null;

		this.type = "utc";
		if (params !== undefined) {
			if (params['type'] !== undefined) {
				this.type = params['type'];
			} else {
				if (params['str'] !== undefined) {
					if (params['str'].match(/^[0-9]{12}Z$/)) this.type = "utc";
					if (params['str'].match(/^[0-9]{14}Z$/)) this.type = "gen";
				}
			}
			this.timeParams = params;
		}
	}

	/**
	 * @param {Object} timeParams 
	 */
	setTimeParams(timeParams) {
		this.timeParams = timeParams;
	}

	/**
	 * @override
	 * @returns {string}
	 */
	getEncodedHex() {
		/** @type {DERAbstractTime | null} */ let o = null;

		if (this.timeParams != null) {
			if (this.type == "utc") {
				o = new DERUTCTime(this.timeParams);
			} else {
				o = new DERGeneralizedTime(this.timeParams);
			}
		} else {
			if (this.type == "utc") {
				o = new DERUTCTime();
			} else {
				o = new DERGeneralizedTime();
			}
		}
		this.TLV = o.getEncodedHex();
		return this.TLV;
	}
}

/**
 * AlgorithmIdentifier ASN.1 structure class
 * @param {Object} params dictionary of parameters (ex. {'name': 'SHA1withRSA'})
 * @description
 * The 'params' argument is an associative array and has following parameters:
 * <ul>
 * <li>name: algorithm name (MANDATORY, ex. sha1, SHA256withRSA)</li>
 * <li>asn1params: explicitly specify ASN.1 object for algorithm.
 * (OPTION)</li>
 * <li>paramempty: set algorithm parameter to NULL by force.
 * If paramempty is false, algorithm parameter will be set automatically.
 * If paramempty is false and algorithm name is "*withDSA" or "withECDSA" parameter field of
 * AlgorithmIdentifier will be ommitted otherwise
 * it will be NULL by default.
 * (OPTION, DEFAULT = false)</li>
 * </ul>
 * @example
 * algId = new AlgorithmIdentifier({name: "sha1"});
 * // set parameter to NULL authomatically if algorithm name is "*withRSA".
 * algId = new AlgorithmIdentifier({name: "SHA256withRSA"});
 * // set parameter to NULL authomatically if algorithm name is "rsaEncryption".
 * algId = new AlgorithmIdentifier({name: "rsaEncryption"});
 * // SHA256withRSA and set parameter empty by force
 * algId = new AlgorithmIdentifier({name: "SHA256withRSA", paramempty: true});
 */
export class AlgorithmIdentifier extends ASN1Object {
	/**
	 * @param {Object=} params 
	 */
	constructor(params) {
		super();

		/** @type {string | null} */ this.nameAlg = null;
		/** @type {DERObjectIdentifier | null} */ this.asn1Alg = null;
		/** @type {ASN1Object | null} */ this.asn1Params = null;
		this.paramEmpty = false;

		if (params !== undefined) {
			if (params['name'] !== undefined) {
				this.nameAlg = String(params['name']);
			}
			if (params['asn1params'] !== undefined) {
				this.asn1Params = params['asn1params'];
			}
			if (params['paramempty'] !== undefined) {
				this.paramEmpty = params['paramempty'] ? true : false;
			}
		}
	
		// set algorithm parameters will be ommitted for
		// "*withDSA" or "*withECDSA" otherwise will be NULL.
		if (this.asn1Params === null &&
			this.paramEmpty === false &&
			this.nameAlg !== null) {
			let lcNameAlg = this.nameAlg.toLowerCase();
			if (lcNameAlg.substr(-7, 7) !== "withdsa" &&
				lcNameAlg.substr(-9, 9) !== "withecdsa") {
				this.asn1Params = new DERNull();
			}
		}
	}

	/**
	 * @override
	 * @returns {string}
	 */
	getEncodedHex() {
		if (this.nameAlg === null && this.asn1Alg === null) {
			throw "algorithm not specified";
		}
		if (this.nameAlg !== null && this.asn1Alg === null) {
			this.asn1Alg = name2obj(this.nameAlg);
		}
		let a = [this.asn1Alg];
		if (this.asn1Params !== null) a.push(this.asn1Params);

		let o = new DERSequence({ 'array': a });
		this.hTLV = o.getEncodedHex();
		return this.hTLV;
	}
}

/**
 * GeneralName ASN.1 structure class<br/> * @description
 * <br/>
 * As for argument 'params' for constructor, you can specify one of
 * following properties:
 * <ul>
 * <li>rfc822 - rfc822Name[1] (ex. user1@foo.com)</li>
 * <li>dns - dNSName[2] (ex. foo.com)</li>
 * <li>uri - uniformResourceIdentifier[6] (ex. http://foo.com/)</li>
 * <li>dn - directoryName[4] (ex. /C=US/O=Test)</li>
 * <li>ldapdn - directoryName[4] (ex. O=Test,C=US)</li>
 * <li>certissuer - directoryName[4] (PEM or hex string of cert)</li>
 * <li>certsubj - directoryName[4] (PEM or hex string of cert)</li>
 * <li>ip - iPAddress[7] (ex. 192.168.1.1, 2001:db3::43, 3faa0101...)</li>
 * </ul>
 * NOTE1: certissuer and certsubj were supported since asn1x509 1.0.10.<br/>
 * NOTE2: dn and ldapdn were supported since jsrsasign 6.2.3 asn1x509 1.0.19.<br/>
 * NOTE3: ip were supported since jsrsasign 8.0.10 asn1x509 1.1.4.<br/>
 *
 * Here is definition of the ASN.1 syntax:
 * <pre>
 * -- NOTE: under the CHOICE, it will always be explicit.
 * GeneralName ::= CHOICE {
 *   otherName                  [0] OtherName,
 *   rfc822Name                 [1] IA5String,
 *   dNSName                    [2] IA5String,
 *   x400Address                [3] ORAddress,
 *   directoryName              [4] Name,
 *   ediPartyName               [5] EDIPartyName,
 *   uniformResourceIdentifier  [6] IA5String,
 *   iPAddress                  [7] OCTET STRING,
 *   registeredID               [8] OBJECT IDENTIFIER }
 * </pre>
 *
 * @example
 * gn = new GeneralName({rfc822:     'test@aaa.com'});
 * gn = new GeneralName({dns:        'aaa.com'});
 * gn = new GeneralName({uri:        'http://aaa.com/'});
 * gn = new GeneralName({dn:         '/C=US/O=Test'});
 * gn = new GeneralName({ldapdn:     'O=Test,C=US'});
 * gn = new GeneralName({certissuer: certPEM});
 * gn = new GeneralName({certsubj:   certPEM});
 * gn = new GeneralName({ip:         '192.168.1.1'});
 * gn = new GeneralName({ip:         '2001:db4::4:1'});
 * gn = new GeneralName({ip:         'c0a80101'});
 */
export class GeneralName extends ASN1Object {
	/**
	 * @param {Object=} params 
	 */
	constructor(params) {
		super();

		this.asn1Obj = null;
		/** @type {string | null} */ this.type = null;
		this.pTag = { 'rfc822': '81', 'dns': '82', 'dn': 'a4', 'uri': '86', 'ip': '87' };

		this.explicit = false;

		if (params !== undefined) {
			this.setByParam(params);
		}
	}

	/**
	 * @param {Object} params 
	 */
	setByParam(params) {
		/** @type {ASN1Object | null} */ let v = null;

		if (params === undefined) return;

		if (params['rfc822'] !== undefined) {
			this.type = 'rfc822';
			v = new DERIA5String({ 'str': params[this.type] });
		}

		if (params['dns'] !== undefined) {
			this.type = 'dns';
			v = new DERIA5String({ 'str': params[this.type] });
		}

		if (params['uri'] !== undefined) {
			this.type = 'uri';
			v = new DERIA5String({ 'str': params[this.type] });
		}

		if (params['dn'] !== undefined) {
			this.type = 'dn';
			this.explicit = true;
			v = new X500Name({ 'str': params['dn'] });
		}

		if (params['ldapdn'] !== undefined) {
			this.type = 'dn';
			this.explicit = true;
			v = new X500Name({ 'ldapstr': params['ldapdn'] });
		}

		if (params['certissuer'] !== undefined) {
			this.type = 'dn';
			this.explicit = true;
			let certStr = params['certissuer'];
			let certHex = null;

			if (certStr.match(/^[0-9A-Fa-f]+$/)) {
				certHex == certStr;
			}

			if (certStr.indexOf("-----BEGIN ") != -1) {
				certHex = pemtohex(certStr);
			}

			if (certHex == null) throw "certissuer param not cert";
			let x = new X509();
			x.hex = certHex;
			let dnHex = x.getIssuerHex();
			v = new ASN1Object();
			v.hTLV = dnHex;
		}

		if (params['certsubj'] !== undefined) {
			this.type = 'dn';
			this.explicit = true;
			let certStr = params['certsubj'];
			let certHex = null;
			if (certStr.match(/^[0-9A-Fa-f]+$/)) {
				certHex == certStr;
			}
			if (certStr.indexOf("-----BEGIN ") != -1) {
				certHex = pemtohex(certStr);
			}
			if (certHex == null) throw "certsubj param not cert";
			let x = new X509();
			x.hex = certHex;
			let dnHex = x.getSubjectHex();
			v = new ASN1Object();
			v.hTLV = dnHex;
		}

		if (params['ip'] !== undefined) {
			this.type = 'ip';
			this.explicit = false;
			let ip = params['ip'];
			let hIP;
			let malformedIPMsg = "malformed IP address";
			if (ip.match(/^[0-9.]+[.][0-9.]+$/)) { // ipv4
				hIP = intarystrtohex("[" + ip.split(".").join(",") + "]");
				if (hIP.length !== 8) throw malformedIPMsg;
			} else if (ip.match(/^[0-9A-Fa-f:]+:[0-9A-Fa-f:]+$/)) { // ipv6
				hIP = ipv6tohex(ip);
			} else if (ip.match(/^([0-9A-Fa-f][0-9A-Fa-f]){1,}$/)) { // hex
				hIP = ip;
			} else {
				throw malformedIPMsg;
			}
			v = new DEROctetString({ 'hex': hIP });
		}

		if (this.type == null)
			throw "unsupported type in params=" + params;
		this.asn1Obj = new DERTaggedObject({
			'explicit': this.explicit,
			'tag': pTag[this.type],
			'obj': v
		});
	}

	/**
	 * @override
	 * @returns {string}
	 */
	getEncodedHex() {
		return this.asn1Obj.getEncodedHex();
	}
}

/**
 * GeneralNames ASN.1 structure class<br/> * @description
 * <br/>
 * <h4>EXAMPLE AND ASN.1 SYNTAX</h4>
 * @example
 * gns = new GeneralNames([{'uri': 'http://aaa.com/'}, {'uri': 'http://bbb.com/'}]);
 *
 * GeneralNames ::= SEQUENCE SIZE (1..MAX) OF GeneralName
 */
export class GeneralNames extends ASN1Object {
	/**
	 * @param {Array<Object>=} paramsArray 
	 */
	constructor(paramsArray) {
		super();

		/** @type {Array<GeneralName>} */ this.asn1Array = new Array();

		if (typeof paramsArray != "undefined") {
			this.setByParamArray(paramsArray);
		}
	}

    /**
     * set a array of {@link GeneralName} parameters<br/>
     * @param {Array} paramsArray Array of {@link GeneralNames}
     * @description
     * <br/>
     * <h4>EXAMPLES</h4>
     * @example
     * gns = new GeneralNames();
     * gns.setByParamArray([{uri: 'http://aaa.com/'}, {uri: 'http://bbb.com/'}]);
     */
	setByParamArray(paramsArray) {
		for (let i = 0; i < paramsArray.length; i++) {
			let o = new GeneralName(paramsArray[i]);
			this.asn1Array.push(o);
		}
	}

	/**
	 * @override
	 * @returns {string}
	 */
	getEncodedHex() {
		let o = new DERSequence({ 'array': this.asn1Array });
		return o.getEncodedHex();
	}
}

/**
 * DistributionPointName ASN.1 structure class<br/> * @description
 * <pre>
 * DistributionPoint ::= SEQUENCE {
 *      distributionPoint       [0]     DistributionPointName OPTIONAL,
 *      reasons                 [1]     ReasonFlags OPTIONAL,
 *      cRLIssuer               [2]     GeneralNames OPTIONAL }
 *
 * DistributionPointName ::= CHOICE {
 *      fullName                [0]     GeneralNames,
 *      nameRelativeToCRLIssuer [1]     RelativeDistinguishedName }
 * 
 * ReasonFlags ::= BIT STRING {
 *      unused                  (0),
 *      keyCompromise           (1),
 *      cACompromise            (2),
 *      affiliationChanged      (3),
 *      superseded              (4),
 *      cessationOfOperation    (5),
 *      certificateHold         (6),
 *      privilegeWithdrawn      (7),
 *      aACompromise            (8) }
 * </pre>
 * @example
 */
export class DistributionPointName extends ASN1Object {
	/**
	 * @param {Object=} gnOrRdn 
	 */
	constructor(gnOrRdn) {
		super();

		/** @type {DERTaggedObject | null} */ this.asn1Obj = null;
		/** @type {string | null} */ this.type = null;
		/** @type {string | null} */ this.tag = null;
		/** @type {GeneralNames | null} */ this.asn1V = null;

		if (gnOrRdn !== undefined) {
			if (gnOrRdn instanceof GeneralNames) {
				this.type = "full";
				this.tag = "a0";
				this.asn1V = gnOrRdn;
			} else {
				throw "This class supports GeneralNames only as argument";
			}
		}
	}

	/**
	 * @override
	 * @returns {string}
	 */
	getEncodedHex() {
		if (this.type != "full")
			throw "currently type shall be 'full': " + this.type;
		this.asn1Obj = new DERTaggedObject({
			'explicit': false,
			'tag': this.tag,
			'obj': this.asn1V
		});
		this.hTLV = this.asn1Obj.getEncodedHex();
		return this.hTLV;
	}
}

/**
 * DistributionPoint ASN.1 structure class<br/> * @description
 * <pre>
 * DistributionPoint ::= SEQUENCE {
 *      distributionPoint       [0]     DistributionPointName OPTIONAL,
 *      reasons                 [1]     ReasonFlags OPTIONAL,
 *      cRLIssuer               [2]     GeneralNames OPTIONAL }
 *
 * DistributionPointName ::= CHOICE {
 *      fullName                [0]     GeneralNames,
 *      nameRelativeToCRLIssuer [1]     RelativeDistinguishedName }
 * 
 * ReasonFlags ::= BIT STRING {
 *      unused                  (0),
 *      keyCompromise           (1),
 *      cACompromise            (2),
 *      affiliationChanged      (3),
 *      superseded              (4),
 *      cessationOfOperation    (5),
 *      certificateHold         (6),
 *      privilegeWithdrawn      (7),
 *      aACompromise            (8) }
 * </pre>
 * @example
 */
export class DistributionPoint extends ASN1Object {
	/**
	 * @param {Object=} params 
	 */
	constructor(params) {
		super();

		/** @type {ASN1Object | null} */ this.asn1DP = null;

		if (params !== undefined) {
			if (params['dpobj'] !== undefined) {
				this.asn1DP = params['dpobj'];
			}
		}
	}

	/**
	 * @override
	 * @returns {string}
	 */
	getEncodedHex() {
		let seq = new DERSequence();
		if (this.asn1DP != null) {
			let o1 = new DERTaggedObject({
				'explicit': true,
				'tag': 'a0',
				'obj': this.asn1DP
			});
			seq.appendASN1Object(o1);
		}
		this.hTLV = seq.getEncodedHex();
		return this.hTLV;
	}
}

/**
 * issue a certificate in PEM format
 * @name newCertPEM
 * @param {Object} param parameter to issue a certificate
 * @description
 * This method can issue a certificate by a simple
 * JSON object.
 * Signature value will be provided by signing with
 * private key using 'cakey' parameter or
 * hexa decimal signature value by 'sighex' parameter.
 * <br/>
 * NOTE: Algorithm parameter of AlgorithmIdentifier will
 * be set automatically by default. (see {@link AlgorithmIdentifier})
 * from jsrsasign 7.1.1 asn1x509 1.0.20.
 *
 * @example
 * let certPEM = newCertPEM({
 *   'serial': {'int': 4},
 *   'sigalg': {'name': 'SHA1withECDSA'},
 *   'issuer': {'str': '/C=US/O=a'},
 *   'notbefore': {'str': '130504235959Z'},
 *   'notafter': {'str': '140504235959Z'},
 *   'subject': {'str': '/C=US/O=b'},
 *   'sbjpubkey': pubKeyObj,
 *   'ext': [
 *     {'basicConstraints': {'cA': true, 'critical': true}},
 *     {'keyUsage': {'bin': '11'}},
 *   ],
 *   'cakey': prvKeyObj
 * });
 * // -- or --
 * let certPEM = newCertPEM({
 *   'serial': {'int': 4},
 *   'sigalg': {'name': 'SHA1withECDSA'},
 *   'issuer': {'str': '/C=US/O=a'},
 *   'notbefore': {'str': '130504235959Z'},
 *   'notafter': {'str': '140504235959Z'},
 *   'subject': {str: '/C=US/O=b'},
 *   'sbjpubkey': pubKeyPEM,
 *   'ext': [
 *     {'basicConstraints': {'cA': true, 'critical': true}},
 *     {'keyUsage': {'bin': '11'}},
 *   ],
 *   'cakey': [prvkey, pass]}
 * );
 * // -- or --
 * let certPEM = newCertPEM({
 *   'serial': {'int': 1},
 *   'sigalg': {'name': 'SHA1withRSA'},
 *   'issuer': {'str': '/C=US/O=T1'},
 *   'notbefore': {'str': '130504235959Z'},
 *   'notafter': {'str': '140504235959Z'},
 *   'subject': {'str': '/C=US/O=T1'},
 *   'sbjpubkey': pubKeyObj,
 *   'sighex': '0102030405..'
 * });
 * // for the issuer and subject field, another
 * // representation is also available
 * let certPEM = newCertPEM({
 *   'serial': {'int': 1},
 *   'sigalg': {'name': 'SHA256withRSA'},
 *   'issuer': {'C': "US", 'O': "T1"},
 *   'notbefore': {'str': '130504235959Z'},
 *   'notafter': {'str': '140504235959Z'},
 *   'subject': {'C': "US", 'O': "T1", 'CN': "http://example.com/"},
 *   'sbjpubkey': pubKeyObj,
 *   'sighex': '0102030405..'
 * });
 */
export function newCertPEM(param) {
	let o = new TBSCertificate();

	if (param['serial'] !== undefined)
		o.setSerialNumberByParam(param['serial']);
	else
		throw "serial number undefined.";

	if (typeof param['sigalg']['name'] === 'string')
		o.setSignatureAlgByParam(param['sigalg']);
	else
		throw "unproper signature algorithm name";

	if (param['issuer'] !== undefined)
		o.setIssuerByParam(param['issuer']);
	else
		throw "issuer name undefined.";

	if (param['notbefore'] !== undefined)
		o.setNotBeforeByParam(param['notbefore']);
	else
		throw "notbefore undefined.";

	if (param['notafter'] !== undefined)
		o.setNotAfterByParam(param['notafter']);
	else
		throw "notafter undefined.";

	if (param['subject'] !== undefined)
		o.setSubjectByParam(param['subject']);
	else
		throw "subject name undefined.";

	if (param['sbjpubkey'] !== undefined)
		o.setSubjectPublicKeyByGetKey(param['sbjpubkey']);
	else
		throw "subject public key undefined.";

	if (param['ext'] !== undefined && param['ext'].length !== undefined) {
		for (let i = 0; i < param['ext'].length; i++) {
			for (key in param['ext'][i]) {
				o.appendExtensionByName(key, param['ext'][i][key]);
			}
		}
	}

	// set signature
	if (param['cakey'] === undefined && param['sighex'] === undefined)
		throw "param cakey and sighex undefined.";

	let caKey = null;
	let cert = null;

	if (param['cakey']) {
		if (param['cakey'].isPrivate === true) {
			caKey = param['cakey'];
		} else {
			caKey = KEYUTIL.getKey.apply(null, param['cakey']);
		}
		cert = new Certificate({ 'tbscertobj': o, 'prvkeyobj': caKey });
		cert.sign();
	}

	if (param['sighex']) {
		cert = new Certificate({ 'tbscertobj': o });
		cert.setSignatureHex(param['sighex']);
	}

	return cert.getPEMString();
}
