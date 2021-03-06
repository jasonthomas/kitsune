.. _search-chapter:

======
Search
======

Kitsune is in the process of switching from `Sphinx Search
<http://www.sphinxsearch.com>`_ to `Elastic Search
<http://www.elasticsearch.org/>`_ to power its on-site search
facility.

Both of these give us a number of advantages over MySQL's full-text
search or Google's site search.

* Much faster than MySQL.
  * And reduces load on MySQL.
* We have total control over what results look like.
* We can adjust searches with non-visible content.
* We don't rely on Google reindexing the site.
* We can fine-tune the algorithm ourselves.


.. Note::

   Right now we're rewriting our search system to use Elastic and
   switching between Sphinx and Elastic.  At some point, the results
   we're getting with our Elastic-based code will be good enough to
   switch over.  At that point, we'll remove the Sphinx-based search
   code.

   Until then, we have instructions for installing both Sphinx Search
   and Elastic Search.

   **To switch between Sphinx Search and Elastic Search**, there's a
   waffle flag.  In the admin, go to waffle, then turn on and off the
   ``elasticsearch`` waffle flag.  If it's on, then Elastic is used.
   If it's off, then Sphinx is used.


Installing Sphinx Search
========================

We currently require **Sphinx 0.9.9**. You may be able to install this from a
package manager like yum, aptitude, or brew.

If not, you can easily `download <http://sphinxsearch.com/downloads/>`_ the
source and compile it. Generally all you'll need to do is::

    $ cd sphinx-0.9.9
    $ ./configure --enable-id64  # Important! We need 64-bit document IDs.
    $ make
    $ sudo make install

This should install Sphinx in ``/usr/local/bin``. (You can change this by
setting the ``--prefix`` argument to ``configure``.)

To test that everything works, make sure that the ``SPHINX_INDEXER`` and
``SPHINX_SEARCHD`` settings point to the ``indexer`` and ``searchd`` binaries,
respectively. (Probably ``/usr/local/bin/indexer`` and
``/usr/local/bin/searchd``, unless you changed the prefix.) Then run the
Kitsune search tests::

    $ ./manage.py test -s --no-input --logging-clear-handlers search

If the tests pass, everything is set up correctly!


Using Sphinx Search
===================

Having Sphinx installed will allow the search tests to run, which may be
enough. But you want to work on or test the search app, you will probably need
to actually see search results!


The Easy, Sort of Wrong Way
---------------------------

The easiest way to start Sphinx for testing is to use some helpful management
commands for developers::

    $ ./manage.py reindex
    $ ./manage.py start_sphinx

You can also stop Sphinx::

    $ ./manage.py stop_sphinx

If you need to update the search indexes, you can pass the ``--rotate`` flag to
``reindex`` to update them in-place::

    $ ./manage.py reindex --rotate

While this method is very easy, you will need to reindex after any time you run
the search tests, as they will overwrite the data files Sphinx uses.


The Complicated but Safe Way
----------------------------

You can safely run multiple instances of ``searchd`` as long as they listen on
different ports, and store their data files in different locations.

The advantage of this method is that you won't need to reindex every time you
run the search tests. Otherwise, this should be identical to the easy method
above.

Start by copying ``configs/sphinx`` to a new directory, for example::

    $ cp -r configs/sphinx ../
    $ cd ../sphinx

Then create your own ``localsettings.py`` file::

    $ cp localsettings.py-dist localsettings.py
    $ vim localsettings.py

Fill in the settings so they match the values in ``settings_local.py``. Pick a
place on the file system for ``ROOT_PATH``.

Once you have tweaked all the settings so Sphinx will be able to talk to your
database and write to the directories, you can run the Sphinx binaries
directly (as long as they are on your ``$PATH``)::

    $ indexer --all -c sphinx.conf
    $ searchd -c sphinx.conf

You can reindex without restarting ``searchd`` by using the ``--rotate`` flag
for ``indexer``::

    $ indexer --all --rotate -c sphinx.conf

You can also stop ``searchd``::

    $ searchd --stop -c sphinx.conf

This method not only lets you maintain a running Sphinx instance that doesn't
get wiped out by the tests, but also lets you see some very interesting output
from Sphinx about indexing rate and statistics.


Installing Elastic Search
=========================

There's an installation guide on the Elastic Search site.

http://www.elasticsearch.org/guide/reference/setup/installation.html

The directory you install Elastic in will hereafter be referred to as
``ELASTICDIR``.

You can configure Elastic Search with the configuration file at
``ELASTICDIR/config/elasticsearch.yml``.

Elastic Search uses two settings in ``settings.py`` that you can
override in ``settings_local.py``::

    # Connection information for Elastic
    ES_HOSTS = ['127.0.0.1:9200']
    ES_INDEXES = {'default': 'sumo'}


.. Warning::

   The host setting must match the host and port in
   ``ELASTICDIR/config/elasticsearch.yml``.  So if you change it in
   one place, you must also change it in the other.

You can also set ``USE_ELASTIC`` in your ``settings_local.py`` file.
This affects whether Kitsune does Elastic indexing when data changes
in the ``post_save`` and ``pre_delete`` hooks.  For tests,
``USE_ELASTIC`` is set to ``False`` except for Elastic specific tests.

There are a few other settings you can set in your settings_local.py
file that override Elastic Utils defaults.  See `the Elastic Utils
docs <http://elasticutils.readthedocs.org/en/latest/installation.html#configure>`_
for details.

.. Note::

   One problem I have on my machine is that it takes a while for
   Elastic to do stuff.  ``ES_TIMEOUT`` defaults to 1, but I set it to
   2 in my ``settings_local.py`` file which reduces the number of
   timeout errors I get.


Using Elastic Search
====================

Running
-------

Start Elastic Search by::

    $ ELASTICDIR/bin/elasticsearch

That launches Elastic Search in the background.


Indexing
--------

Do a complete reindexing of everything by::

    $ ./manage.py esreindex

This will delete the existing indexes, create new ones, and reindex
everything in your database.  On my machine it takes about > 30 minutes.

If you need to get stuff done and don't want to wait for a full indexing,
you can index a percentage of things.

For example, this indexes 10% of your data ordered by id::

    $ ./manage.py esreindex --percent 10

This indexes 50% of your data ordered by id::

    $ ./manage.py esreindex --percent 50

I use this when I'm fiddling with mappings and the indexing code.


.. Note::

   Once you've indexed everything, you won't have to do it again unless
   indexing code changes.  The models have post_save and pre_delete hooks
   that will update the index as the data changes.


Health/statistics
-----------------

You can see Elastic Search statistics/health with::

    $ ./manage.py eswhazzup

I use this to make sure I've got stuff in my index.
