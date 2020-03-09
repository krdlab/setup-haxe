import haxe.Json;

class Main {
  static public function main(): Void {
    var o = { value: 1 };
    var s = Json.stringify(o);
    trace(s);
  }
}
