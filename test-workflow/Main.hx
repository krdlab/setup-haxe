import haxe.Json;
import js.node.Crypto;

class Main {
  static public function main(): Void {
    var o = { value: 1 };
    var s = Json.stringify(o);
    trace(s);

    var cipher = Crypto.createCipher('aes256', 'dummy password');
    cipher.write('some text data');
    cipher.end();
  }
}
