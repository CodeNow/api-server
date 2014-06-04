runnable_api-server Cookbook
===================
This cookbook configures prerequisites for api-server and deploys it.

Via the `Berksfile.lock` file, this cookbook also enforces the versions of all other cookbook dependencies deployed.

Attributes
----------
Currently none.

Usage
-----
#### runnable_api-server::default

e.g.
Just include `runnable_api-server` in your node's `run_list`:

```json
{
  "name":"my_node",
  "run_list": [
    "recipe[runnable_api-server]"
  ]
}
```


Contributing
------------
1. Create a named feature branch (like `add_component_x`)

2. Write your change. If you are adding a new feature, it should most likely be written in a new recipe in the `recipes/` directory. Do not forget to include your recipe from within `recipes/default.rb`.

3. Write tests for your change (if applicable)

4. Run the tests, ensuring they all pass

5. Submit a Pull Request using Github

Testing
-------
#### Prerequisites:
- `vagrant`
- `test-kitchen`
- `berkshelf`
- `kitchen-vagrant`
- `VirtualBox`

#### Steps:
1. Run `berks update`
2. Run `kitchen test`

#### More on testing:
See documentation and examples of minitest-chef-handler for more information: <https://github.com/calavera/minitest-chef-handler>
