/**
 * JSON schema for an expert statement
 *
 * @author localhorst87
 * @readonly
 * @constant {Object}
*/
const EXPERT_STATEMENT = {
    "type": "object",
    "properties": {
        "result": {
            "type": "boolean"
        },
        "log": {
            "type": "string",
            "transform": ["trim"],
            "minLength": 1
        }
    }
};

/**
 * JSON schema for a signed document
 *
 * @author localhorst87
 * @readonly
 * @constant {Object}
*/
const SIGNED_STATEMENT = {
    "type": "object",
    "properties": {
        "content": EXPERT_STATEMENT,
        "signature": {
            "type": "string",
            "minLength": 32
        },
        "hash_algorithm": {
            "type": "string",
            "transform": ["trim", "toEnumCase"],
            "enum": [
                "RSA-MD4",
                "RSA-MD5",
                "RSA-RIPEMD160",
                "RSA-SHA1",
                "RSA-SHA1-2",
                "RSA-SHA224",
                "RSA-SHA256",
                "RSA-SHA3-224",
                "RSA-SHA3-256",
                "RSA-SHA3-384",
                "RSA-SHA3-512",
                "RSA-SHA384",
                "RSA-SHA512",
                "RSA-SHA512/224",
                "RSA-SHA512/256",
                "RSA-SM3",
                "blake2b512",
                "blake2s256",
                "id-rsassa-pkcs1-v1_5-with-sha3-224",
                "id-rsassa-pkcs1-v1_5-with-sha3-256",
                "id-rsassa-pkcs1-v1_5-with-sha3-384",
                "id-rsassa-pkcs1-v1_5-with-sha3-512",
                "md4",
                "md4WithRSAEncryption",
                "md5",
                "md5-sha1",
                "md5WithRSAEncryption",
                "ripemd",
                "ripemd160",
                "ripemd160WithRSA",
                "rmd160",
                "sha1",
                "sha1WithRSAEncryption",
                "sha224",
                "sha224WithRSAEncryption",
                "sha256",
                "sha256WithRSAEncryption",
                "sha3-224",
                "sha3-256",
                "sha3-384",
                "sha3-512",
                "sha384",
                "sha384WithRSAEncryption",
                "sha512",
                "sha512-224",
                "sha512-224WithRSAEncryption",
                "sha512-256",
                "sha512-256WithRSAEncryption",
                "sha512WithRSAEncryption",
                "shake128",
                "shake256",
                "sm3",
                "sm3WithRSAEncryption",
                "ssl3-md5",
                "ssl3-sha1",
                "whirlpool" ]
        },
        "signature_encoding": {
            "enum": ["hex"]
        }
    },
    "required": ["content", "signature", "hash_algorithm", "signature_encoding"]
};

exports.SIGNED_STATEMENT = SIGNED_STATEMENT;
exports.EXPERT_STATEMENT = EXPERT_STATEMENT;